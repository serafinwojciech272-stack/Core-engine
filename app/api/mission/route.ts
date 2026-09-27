import {NextResponse} from "next/server";
import {missions,events,recordMissionEvent,transitionMission,claimMemoryAction,approveCapabilityAction,isCapabilityApproved,claimCapabilityExecution,type MissionState} from "@/lib/engine";
import {evaluateMissionAction} from "@/lib/policy";
import {assessOutcome} from "@/lib/outcome-quality";
import {buildLearningLesson} from "@/lib/learning-engine";
import {claimPersistedAction,listPersistedEvents,listPersistedMissions,recordPersistedLearning,recordPersistedMissionOutcome,storageMode,transitionPersistedMission} from "@/lib/storage";
import {executeCapabilityAction,getCapabilityAction} from "@/lib/capability-action-registry";
import {isPersistedCapabilityApproved,recordCapabilityLedgerEvent} from "@/lib/capability-ledger";
import {guardMutation} from "@/lib/http";
import {authenticate} from "@/lib/auth";
import {resolveTenant} from "@/lib/commercial-runtime";
import {missionBelongsToTenant, recordUsage, tenantMissionIds} from "@/lib/commercial-storage";
import {resolveSaaSContext, consumeSaaSUsage} from "@/lib/saas-runtime";
const MAX=16000;
const nextByAction:Record<string,MissionState>={approve:"APPROVED",reject:"REJECTED",execute:"EXECUTING",measure:"MEASURING",complete:"COMPLETED",learn:"LEARNED",fail:"FAILED",retry:"EXECUTING",abort:"REJECTED"};

export async function GET(request:Request){
  const runtime=await resolveSaaSContext(request);const tenant=runtime.identity?{tenantId:runtime.identity.tenantId,tenantKey:runtime.identity.tenantKey}:runtime.legacyTenant!;
  const limit=Math.max(1,Math.min(100,Number(new URL(request.url).searchParams.get("limit")||50)));
  if(storageMode()==="supabase"){
    try{const ids=new Set(await tenantMissionIds(tenant.tenantId));const all=await listPersistedMissions(Math.max(limit,100));const m=all.filter(x=>ids.has(x.id)).slice(0,limit);const e=(await listPersistedEvents(Math.max(limit,100))).filter(x=>ids.has(x.missionId)).slice(0,limit);return NextResponse.json({ok:true,missions:m,count:m.length,persistence:"supabase",durable:true,tenantId:tenant.tenantId,events:e})}
    catch{return NextResponse.json({ok:false,error:"PERSISTENCE_READ_FAILED"},{status:503})}
  }
  const ids=new Set(await tenantMissionIds(tenant.tenantId));const m=Array.from(missions.values()).filter(x=>ids.has(x.id)).slice(-limit).reverse();const e=events.filter(x=>ids.has(x.missionId)).slice(-100).reverse();return NextResponse.json({ok:true,missions:m,count:m.length,persistence:"in-memory-runtime",durable:false,tenantId:tenant.tenantId,warning:"Non-durable demo mode.",events:e});
}

export async function POST(request:Request){
  const guard=guardMutation(request,"mission");if(guard)return guard;
  const runtime=await resolveSaaSContext(request);const actor=runtime.identity?{id:runtime.identity.userId,kind:"human" as const}:authenticate(request,true);const tenant=runtime.identity?{tenantId:runtime.identity.tenantId,tenantKey:runtime.identity.tenantKey}:runtime.legacyTenant!;
  try{
    const raw=await request.text();
    if(new TextEncoder().encode(raw).byteLength>MAX)return NextResponse.json({ok:false,error:"REQUEST_TOO_LARGE"},{status:413});
    const b=raw?JSON.parse(raw):{};
    const id=String(b.id||""),action=String(b.action||""),key=String(b.idempotencyKey||""),capabilityActionId=String(b.capabilityActionId||"");
    if(!id||!action)return NextResponse.json({ok:false,error:"MISSION_ID_AND_ACTION_REQUIRED"},{status:400});
    const quota=await consumeSaaSUsage(tenant.tenantId,1);
    if(!quota.allowed)return NextResponse.json({ok:false,error:"USAGE_LIMIT_EXCEEDED",quota},{status:402});
    if(!key||key.length>200)return NextResponse.json({ok:false,error:"IDEMPOTENCY_KEY_REQUIRED"},{status:400});
    const next=nextByAction[action];if(!next)return NextResponse.json({ok:false,error:"UNKNOWN_ACTION"},{status:400});
    const outcome=b.outcome&&typeof b.outcome==="object"&&!Array.isArray(b.outcome)?b.outcome as Record<string,unknown>:{};
    const assessment=["measure","complete","learn"].includes(action)?assessOutcome(outcome):null;
    if(action==="complete"&&assessment?.quality==="UNVERIFIED")return NextResponse.json({ok:false,error:"OUTCOME_UNVERIFIED",assessment},{status:422});

    if(storageMode()==="supabase"){
      const current=(await listPersistedMissions(100)).find(m=>m.id===id);if(!current)return NextResponse.json({ok:false,error:"MISSION_NOT_FOUND"},{status:404});
      if(!(await missionBelongsToTenant(id,tenant.tenantId)))return NextResponse.json({ok:false,error:"TENANT_ACCESS_DENIED"},{status:403});
      const policy=evaluateMissionAction(action,current.state);if(!policy.allowed)return NextResponse.json({ok:false,error:"POLICY_DENIED",reason:policy.reason},{status:403});
      const claimKey=capabilityActionId&&["approve","execute","retry"].includes(action)?`${key}:${capabilityActionId}`:key;
      const claim=await claimPersistedAction(id,action,claimKey);if(!claim.claimed)return NextResponse.json({ok:true,duplicate:true,mission:current,action,capabilityActionId:capabilityActionId||undefined,persistence:"supabase",durable:true});

      if(capabilityActionId){
        const capability=getCapabilityAction(capabilityActionId);if(!capability)return NextResponse.json({ok:false,error:"CAPABILITY_ACTION_NOT_FOUND"},{status:404});
        if(action==="approve"){
          await recordCapabilityLedgerEvent(id,"CAPABILITY_APPROVED",{capabilityActionId,actor:policy.actor,idempotencyKey:claimKey});
          const rr=await transitionPersistedMission(id,next,policy.actor);
          return NextResponse.json({ok:true,mission:{...current,state:rr.to_state,executionCount:rr.execution_count,updatedAt:new Date().toISOString()},action,capabilityActionId,capabilityApproval:{status:"APPROVED",persistence:"supabase"},persistence:"supabase",durable:true,capabilityLifecycle:"DURABLE"});
        }
        if((action==="execute"||action==="retry")&&capability.requiresApproval){
          const approved=await isPersistedCapabilityApproved(id,capabilityActionId);
          if(!approved)return NextResponse.json({ok:false,error:"CAPABILITY_APPROVAL_REQUIRED",capabilityActionId},{status:403});
        }
        if(action==="execute"||action==="retry"){
          const receipt=await executeCapabilityAction({actionId:capabilityActionId,approved:true,missionId:id,idempotencyKey:claimKey,input:b.input});
          await recordCapabilityLedgerEvent(id,"CAPABILITY_EXECUTED",{capabilityActionId,receipt});
          await recordCapabilityLedgerEvent(id,"CAPABILITY_OUTCOME_RECORDED",{capabilityActionId,status:receipt.status,sideEffect:receipt.sideEffect});
        }
      }

      let learning=null;if(action==="learn"){if(!assessment||assessment.quality==="UNVERIFIED")return NextResponse.json({ok:false,error:"LEARNING_UNVERIFIED"},{status:422});learning=await recordPersistedLearning(id,buildLearningLesson(assessment,{missionObjective:current.objective,kpi:current.kpi}))}
      const rr=await transitionPersistedMission(id,next,policy.actor);
      if(action==="execute"||action==="retry")await recordPersistedMissionOutcome(id,"EXECUTION_RECORDED",outcome);
      if(action==="measure")await recordPersistedMissionOutcome(id,"MEASUREMENT_RECORDED",{...outcome,assessment});
      const updated={...current,state:rr.to_state,executionCount:rr.execution_count,updatedAt:new Date().toISOString()};
      await recordUsage(tenant.tenantId,actor.id,"MISSION_ACTION",id,1,{action,capabilityActionId:capabilityActionId||null});
      return NextResponse.json({ok:true,mission:updated,action,assessment,learning,persistence:"supabase",durable:true,tenantId:tenant.tenantId,capabilityLifecycle:capabilityActionId?"DURABLE":"STANDARD"});
    }

    const m=missions.get(id);if(!m)return NextResponse.json({ok:false,error:"MISSION_NOT_FOUND"},{status:404});
    if(!(await missionBelongsToTenant(id,tenant.tenantId)))return NextResponse.json({ok:false,error:"TENANT_ACCESS_DENIED"},{status:403});
    const memoryClaimKey=capabilityActionId&&["approve","execute","retry"].includes(action)?`${key}:${capabilityActionId}`:key;
    if(!claimMemoryAction(id,action,memoryClaimKey))return NextResponse.json({ok:true,duplicate:true,mission:m,action,capabilityActionId:capabilityActionId||undefined,persistence:"in-memory-runtime",durable:false});
    const policy=evaluateMissionAction(action,m.state);if(!policy.allowed)return NextResponse.json({ok:false,error:"POLICY_DENIED",reason:policy.reason},{status:403});

    let capabilityReceipt=null;let capabilityApproval=null;
    if(capabilityActionId){
      const capability=getCapabilityAction(capabilityActionId);if(!capability)return NextResponse.json({ok:false,error:"CAPABILITY_ACTION_NOT_FOUND"},{status:404});
      if(action==="approve"){
        const approved=approveCapabilityAction(id,capabilityActionId,memoryClaimKey);
        capabilityApproval={status:approved?"APPROVED":"DUPLICATE",actionId:capabilityActionId};
        if(approved)recordMissionEvent({missionId:id,decisionId:m.decisionId,eventType:"CAPABILITY_APPROVED",actorType:policy.actor,metadata:{capabilityActionId,idempotencyKey:memoryClaimKey}});
      }
      if((action==="execute"||action==="retry")&&capability.requiresApproval&&!isCapabilityApproved(id,capabilityActionId))return NextResponse.json({ok:false,error:"CAPABILITY_APPROVAL_REQUIRED",capabilityActionId},{status:403});
      if(action==="execute"||action==="retry"){
        if(!claimCapabilityExecution(id,capabilityActionId,memoryClaimKey))return NextResponse.json({ok:true,duplicate:true,mission:m,action,capabilityActionId,persistence:"in-memory-runtime",durable:false});
        capabilityReceipt=await executeCapabilityAction({actionId:capabilityActionId,approved:true,missionId:id,idempotencyKey:memoryClaimKey,input:b.input});
        recordMissionEvent({missionId:id,decisionId:m.decisionId,eventType:"CAPABILITY_EXECUTED",actorType:policy.actor,metadata:{capabilityActionId,receipt:capabilityReceipt}});
        recordMissionEvent({missionId:id,decisionId:m.decisionId,eventType:"CAPABILITY_OUTCOME_RECORDED",actorType:"system",metadata:{capabilityActionId,status:capabilityReceipt.status,sideEffect:capabilityReceipt.sideEffect}});
      }
    }

    const updated=transitionMission(m,next);updated.executionCount=action==="execute"||action==="retry"?m.executionCount+1:m.executionCount;missions.set(id,updated);
    const event=recordMissionEvent({missionId:id,decisionId:updated.decisionId,eventType:"STATE_CHANGED",fromState:m.state,toState:updated.state,actorType:policy.actor,metadata:{...outcome,...(assessment?{assessment}:{}),...(capabilityActionId?{capabilityActionId}:{})}});
    await recordUsage(tenant.tenantId,actor.id,"MISSION_ACTION",id,1,{action,capabilityActionId:capabilityActionId||null});
    return NextResponse.json({ok:true,mission:updated,action,assessment,event,capabilityActionId:capabilityActionId||undefined,capabilityApproval,capabilityReceipt,persistence:"in-memory-runtime",durable:false,tenantId:tenant.tenantId,warning:"Non-durable demo mode."});
  }catch(error){console.error("[core-engine] mission operation failed",error);return NextResponse.json({ok:false,error:"MISSION_OPERATION_FAILED"},{status:503})}
}
