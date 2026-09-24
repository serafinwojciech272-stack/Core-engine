import {NextResponse} from "next/server";
import {missions,events,recordMissionEvent,transitionMission,claimMemoryAction,approveCapabilityAction,isCapabilityApproved,claimCapabilityExecution,type MissionState} from "@/lib/engine";
import {evaluateMissionAction} from "@/lib/policy";
import {assessOutcome} from "@/lib/outcome-quality";
import {buildLearningLesson} from "@/lib/learning-engine";
import {claimPersistedAction,listPersistedEvents,listPersistedMissions,recordPersistedLearning,recordPersistedMissionOutcome,storageMode,transitionPersistedMission} from "@/lib/storage";
import {executeCapabilityAction,getCapabilityAction} from "@/lib/capability-action-registry";
import {isPersistedCapabilityApproved,recordCapabilityLedgerEvent} from "@/lib/capability-ledger";
import {guardMutation} from "@/lib/http";
const MAX=16000;
const nextByAction:Record<string,MissionState>={approve:"APPROVED",reject:"REJECTED",execute:"EXECUTING",measure:"MEASURING",complete:"COMPLETED",learn:"LEARNED",fail:"FAILED",retry:"EXECUTING",abort:"REJECTED"};

export async function GET(request:Request){
  const limit=Math.max(1,Math.min(100,Number(new URL(request.url).searchParams.get("limit")||50)));
  if(storageMode()==="supabase"){
    try{const[m,e]=await Promise.all([listPersistedMissions(limit),listPersistedEvents(limit)]);return NextResponse.json({ok:true,missions:m,count:m.length,persistence:"supabase",durable:true,events:e})}
    catch{return NextResponse.json({ok:false,error:"PERSISTENCE_READ_FAILED"},{status:503})}
  }
  return NextResponse.json({ok:true,missions:Array.from(missions.values()).slice(-limit).reverse(),count:missions.size,persistence:"in-memory-runtime",durable:false,warning:"Non-durable demo mode.",events:events.slice(-100).reverse()});
}

export async function POST(request:Request){
  const guard=guardMutation(request,"mission");if(guard)return guard;
  try{
    const raw=await request.text();
    if(new TextEncoder().encode(raw).byteLength>MAX)return NextResponse.json({ok:false,error:"REQUEST_TOO_LARGE"},{status:413});
    const b=raw?JSON.parse(raw):{};
    const id=String(b.id||""),action=String(b.action||""),key=String(b.idempotencyKey||""),capabilityActionId=String(b.capabilityActionId||"");
    if(!id||!action)return NextResponse.json({ok:false,error:"MISSION_ID_AND_ACTION_REQUIRED"},{status:400});
    if(!key||key.length>200)return NextResponse.json({ok:false,error:"IDEMPOTENCY_KEY_REQUIRED"},{status:400});
    const next=nextByAction[action];if(!next)return NextResponse.json({ok:false,error:"UNKNOWN_ACTION"},{status:400});
    const outcome=b.outcome&&typeof b.outcome==="object"&&!Array.isArray(b.outcome)?b.outcome as Record<string,unknown>:{};
    const assessment=["measure","complete","learn"].includes(action)?assessOutcome(outcome):null;
    if(action==="complete"&&assessment?.quality==="UNVERIFIED")return NextResponse.json({ok:false,error:"OUTCOME_UNVERIFIED",assessment},{status:422});

    if(storageMode()==="supabase"){
      const current=(await listPersistedMissions(100)).find(m=>m.id===id);if(!current)return NextResponse.json({ok:false,error:"MISSION_NOT_FOUND"},{status:404});
      const policy=evaluateMissionAction(action,current.state);if(!policy.allowed)return NextResponse.json({ok:false,error:"POLICY_DENIED",reason:policy.reason},{status:403});
      const claim=await claimPersistedAction(id,action,key);if(!claim.claimed)return NextResponse.json({ok:true,duplicate:true,mission:current,action,persistence:"supabase",durable:true});

      if(capabilityActionId){
        const capability=getCapabilityAction(capabilityActionId);if(!capability)return NextResponse.json({ok:false,error:"CAPABILITY_ACTION_NOT_FOUND"},{status:404});
        if(action==="approve"){
          const approvalKey=`${key}:${capabilityActionId}`;
          const approvalClaim=await claimPersistedAction(id,"capability-approve",approvalKey);
          if(!approvalClaim.claimed)return NextResponse.json({ok:true,duplicate:true,mission:current,action,capabilityActionId,persistence:"supabase",durable:true});
          await recordCapabilityLedgerEvent(id,"CAPABILITY_APPROVED",{capabilityActionId,actor:policy.actor,idempotencyKey:approvalKey});
          const rr=await transitionPersistedMission(id,next,policy.actor);
          return NextResponse.json({ok:true,mission:{...current,state:rr.to_state,executionCount:rr.execution_count,updatedAt:new Date().toISOString()},action,capabilityActionId,capabilityApproval:{status:"APPROVED",persistence:"supabase"},persistence:"supabase",durable:true,capabilityLifecycle:"DURABLE"});
        }
        if((action==="execute"||action==="retry")&&capability.requiresApproval){
          const approved=await isPersistedCapabilityApproved(id,capabilityActionId);
          if(!approved)return NextResponse.json({ok:false,error:"CAPABILITY_APPROVAL_REQUIRED",capabilityActionId},{status:403});
        }
        if(action==="execute"||action==="retry"){
          const receipt=executeCapabilityAction({actionId:capabilityActionId,approved:true});
          await recordCapabilityLedgerEvent(id,"CAPABILITY_EXECUTED",{capabilityActionId,receipt});
          await recordCapabilityLedgerEvent(id,"CAPABILITY_OUTCOME_RECORDED",{capabilityActionId,status:receipt.status,sideEffect:receipt.sideEffect});
        }
      }

      let learning=null;if(action==="learn"){if(!assessment||assessment.quality==="UNVERIFIED")return NextResponse.json({ok:false,error:"LEARNING_UNVERIFIED"},{status:422});learning=await recordPersistedLearning(id,buildLearningLesson(assessment,{missionObjective:current.objective,kpi:current.kpi}))}
      const rr=await transitionPersistedMission(id,next,policy.actor);
      if(action==="execute"||action==="retry")await recordPersistedMissionOutcome(id,"EXECUTION_RECORDED",outcome);
      if(action==="measure")await recordPersistedMissionOutcome(id,"MEASUREMENT_RECORDED",{...outcome,assessment});
      const updated={...current,state:rr.to_state,executionCount:rr.execution_count,updatedAt:new Date().toISOString()};
      return NextResponse.json({ok:true,mission:updated,action,assessment,learning,persistence:"supabase",durable:true,capabilityLifecycle:capabilityActionId?"DURABLE":"STANDARD"});
    }

    const m=missions.get(id);if(!m)return NextResponse.json({ok:false,error:"MISSION_NOT_FOUND"},{status:404});
    if(!claimMemoryAction(id,action,key))return NextResponse.json({ok:true,duplicate:true,mission:m,action,persistence:"in-memory-runtime",durable:false});
    const policy=evaluateMissionAction(action,m.state);if(!policy.allowed)return NextResponse.json({ok:false,error:"POLICY_DENIED",reason:policy.reason},{status:403});

    let capabilityReceipt=null;let capabilityApproval=null;
    if(capabilityActionId){
      const capability=getCapabilityAction(capabilityActionId);if(!capability)return NextResponse.json({ok:false,error:"CAPABILITY_ACTION_NOT_FOUND"},{status:404});
      if(action==="approve"){
        const approved=approveCapabilityAction(id,capabilityActionId,key);
        capabilityApproval={status:approved?"APPROVED":"DUPLICATE",actionId:capabilityActionId};
        if(approved)recordMissionEvent({missionId:id,decisionId:m.decisionId,eventType:"CAPABILITY_APPROVED",actorType:policy.actor,metadata:{capabilityActionId,idempotencyKey:key}});
      }
      if((action==="execute"||action==="retry")&&capability.requiresApproval&&!isCapabilityApproved(id,capabilityActionId))return NextResponse.json({ok:false,error:"CAPABILITY_APPROVAL_REQUIRED",capabilityActionId},{status:403});
      if(action==="execute"||action==="retry"){
        if(!claimCapabilityExecution(id,capabilityActionId,key))return NextResponse.json({ok:true,duplicate:true,mission:m,action,capabilityActionId,persistence:"in-memory-runtime",durable:false});
        capabilityReceipt=executeCapabilityAction({actionId:capabilityActionId,approved:true});
        recordMissionEvent({missionId:id,decisionId:m.decisionId,eventType:"CAPABILITY_EXECUTED",actorType:policy.actor,metadata:{capabilityActionId,receipt:capabilityReceipt}});
        recordMissionEvent({missionId:id,decisionId:m.decisionId,eventType:"CAPABILITY_OUTCOME_RECORDED",actorType:"system",metadata:{capabilityActionId,status:capabilityReceipt.status,sideEffect:capabilityReceipt.sideEffect}});
      }
    }

    const updated=transitionMission(m,next);updated.executionCount=action==="execute"||action==="retry"?m.executionCount+1:m.executionCount;missions.set(id,updated);
    const event=recordMissionEvent({missionId:id,decisionId:updated.decisionId,eventType:"STATE_CHANGED",fromState:m.state,toState:updated.state,actorType:policy.actor,metadata:{...outcome,...(assessment?{assessment}:{}),...(capabilityActionId?{capabilityActionId}:{})}});
    return NextResponse.json({ok:true,mission:updated,action,assessment,event,capabilityActionId:capabilityActionId||undefined,capabilityApproval,capabilityReceipt,persistence:"in-memory-runtime",durable:false,warning:"Non-durable demo mode."});
  }catch(error){console.error("[core-engine] mission operation failed",error);return NextResponse.json({ok:false,error:"MISSION_OPERATION_FAILED"},{status:503})}
}
