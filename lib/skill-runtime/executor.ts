import {claimCapabilityExecution,isCapabilityApproved,recordMissionEvent} from "@/lib/engine";
import {executeCapabilityAction} from "@/lib/capability-action-registry";
import {getSkillAdapter,getSkillPack} from "./registry";
import {validatePermission} from "./policy";
import type {SkillAuditEvent,SkillExecutionResult,SkillPermission} from "./contracts";

const executionKeys=new Map<string,SkillExecutionResult>();
function audit(event:SkillAuditEvent){if(event.missionId)recordMissionEvent({missionId:event.missionId,eventType:event.status==="EXECUTED"?"CAPABILITY_EXECUTED":event.status==="FAILED"?"CAPABILITY_EXECUTION_FAILED":"STATE_CHANGED",actorType:"agent",metadata:{skillRuntime:true,...event}});}
export function clearSkillExecutionKeys(){executionKeys.clear();}
export async function executeSkillAction(input:{skillId:string;actionId:string;missionId?:string;tenantId?:string;permissions:SkillPermission[];approved:boolean;idempotencyKey?:string;payload?:Record<string,unknown>;attempt?:number;workspaceRoot?:string}):Promise<SkillExecutionResult>{
 const pack=getSkillPack(input.skillId);const action=pack?.actions.find(a=>a.id===input.actionId);
 if(!action)return{status:"BLOCKED",skillId:input.skillId,actionId:input.actionId,adapterId:"",attempt:1,message:"SKILL_ACTION_NOT_FOUND"};
 const adapter=getSkillAdapter(action.adapterId);
 if(!adapter){const r={status:"ADAPTER_NOT_FOUND" as const,skillId:input.skillId,actionId:action.id,adapterId:action.adapterId,attempt:1,message:"ADAPTER_NOT_FOUND"};audit({type:"SKILL_BLOCKED",...r,status:r.status,createdAt:new Date().toISOString()});return r;}
 if(action.requiresApproval&&!input.approved){const r={status:"APPROVAL_REQUIRED" as const,skillId:input.skillId,actionId:action.id,adapterId:adapter.id,attempt:1,message:"APPROVAL_REQUIRED"};audit({type:"SKILL_APPROVAL_REQUIRED",...r,status:r.status,createdAt:new Date().toISOString()});return r;}
 if(action.requiresIdempotency&&!input.idempotencyKey?.trim())return{status:"IDEMPOTENCY_REQUIRED",skillId:input.skillId,actionId:action.id,adapterId:adapter.id,attempt:1,message:"IDEMPOTENCY_KEY_REQUIRED"};
 if(input.idempotencyKey){const existing=executionKeys.get(input.idempotencyKey);if(existing&&existing.actionId!==action.id)return{status:"IDEMPOTENCY_CONFLICT",skillId:input.skillId,actionId:action.id,adapterId:adapter.id,attempt:existing.attempt,message:"IDEMPOTENCY_CONFLICT"};if(existing&&existing.status==="EXECUTED")return{...existing,message:"Idempotent replay: no new side effect was produced."};}
 const permission=validatePermission(action,input.permissions);if(!permission.ok)return{status:"BLOCKED",skillId:input.skillId,actionId:action.id,adapterId:adapter.id,attempt:1,message:permission.reason};
 if(action.capabilityActionId){
  if(input.missionId&&!isCapabilityApproved(input.missionId,action.capabilityActionId))return{status:"APPROVAL_REQUIRED",skillId:input.skillId,actionId:action.id,adapterId:adapter.id,attempt:1,message:"EXISTING_CAPABILITY_APPROVAL_REQUIRED"};
  if(input.idempotencyKey&&input.missionId&&!claimCapabilityExecution(input.missionId,action.capabilityActionId,input.idempotencyKey))return{status:"IDEMPOTENCY_CONFLICT",skillId:input.skillId,actionId:action.id,adapterId:adapter.id,attempt:1,message:"IDEMPOTENCY_CONFLICT"};
  const receipt=await executeCapabilityAction({actionId:action.capabilityActionId,approved:input.approved,missionId:input.missionId,idempotencyKey:input.idempotencyKey,input:input.payload,attempt:input.attempt});
  const status:SkillExecutionResult["status"]=receipt.status==="EXECUTED"?"EXECUTED":receipt.status==="RETRYABLE"?"RETRYABLE":receipt.status==="APPROVAL_REQUIRED"?"APPROVAL_REQUIRED":receipt.status==="ADAPTER_NOT_FOUND"?"ADAPTER_NOT_FOUND":receipt.status==="IDEMPOTENCY_CONFLICT"?"IDEMPOTENCY_CONFLICT":"FAILED";
  const r={status,skillId:input.skillId,actionId:action.id,adapterId:adapter.id,attempt:receipt.attempt,message:receipt.message,output:receipt.output,provenance:{executionId:receipt.executionId,capabilityActionId:receipt.capabilityActionId}};
  if(input.idempotencyKey)executionKeys.set(input.idempotencyKey,r); audit({type:status==="EXECUTED"?"SKILL_EXECUTED":"SKILL_FAILED",...r,status,createdAt:new Date().toISOString()});return r;
 }
 const attempt=Math.max(1,input.attempt??1);
 if(attempt>action.retryPolicy.maxAttempts)return{status:"BLOCKED",skillId:input.skillId,actionId:action.id,adapterId:adapter.id,attempt,message:"RETRY_BUDGET_EXHAUSTED"};
 try{
  const result=await adapter.execute({missionId:input.missionId,tenantId:input.tenantId,workspaceRoot:input.workspaceRoot,input:input.payload??{},idempotencyKey:input.idempotencyKey,attempt},action);
  const status:SkillExecutionResult["status"]=result.status==="EXECUTED"?"EXECUTED":result.retryable?"RETRYABLE":"FAILED";
  const r={status,skillId:input.skillId,actionId:action.id,adapterId:adapter.id,attempt,message:result.message,output:result.output,provenance:result.provenance};
  if(input.idempotencyKey)executionKeys.set(input.idempotencyKey,r);audit({type:status==="EXECUTED"?"SKILL_EXECUTED":"SKILL_FAILED",...r,status,createdAt:new Date().toISOString()});return r;
 }catch(error){const message=error instanceof Error?error.message:"SKILL_ADAPTER_EXECUTION_FAILED";const r={status:"FAILED" as const,skillId:input.skillId,actionId:action.id,adapterId:adapter.id,attempt,message};audit({type:"SKILL_FAILED",...r,status:r.status,createdAt:new Date().toISOString()});return r;}
}
