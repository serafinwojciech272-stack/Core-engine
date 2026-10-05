import { NextResponse } from "next/server";
import {
  appendLedgerEvent, isLedgerIntact, idempotencyKey, routeCapability, buildContextSnapshot,
  enforceBudget, acquireLease, buildEvidenceChain, convergeOutcome, classifyFailure,
  scoreProviderHealth, buildHandoffEnvelope, validateScope, reconcileMemory,
  certifyUniversalAgent, readinessGate
} from "@/lib/universal-agent-fabric";
import { guardMutation } from "@/lib/http";

export async function GET() {
  return NextResponse.json({ok:true,service:"universal-agent-fabric",version:"uaf-v1",stages:Array.from({length:15},(_,i)=>136+i),executionPolicy:"GOVERNED_APPROVED"});
}
export async function POST(request: Request) {
  const guard=guardMutation(request,"universal-agent-fabric"); if(guard) return guard;
  try {
    const body=await request.json(); const action=String(body.action||"readiness");
    if(action==="ledger") return NextResponse.json({ok:true,events:appendLedgerEvent(Array.isArray(body.events)?body.events:[],body.event),intact:isLedgerIntact(Array.isArray(body.events)?body.events:[])});
    if(action==="idempotency") return NextResponse.json({ok:true,key:idempotencyKey(String(body.runId),String(body.actionName),Number(body.revision))});
    if(action==="route") return NextResponse.json({ok:true,routing:routeCapability(body.graph??{},String(body.capability),body.availableProviders??[])});
    if(action==="context") return NextResponse.json({ok:true,snapshot:buildContextSnapshot(body.input??{})});
    if(action==="budget") return NextResponse.json({ok:true,result:enforceBudget(body.scope,Number(body.estimatedCost))});
    if(action==="lease") return NextResponse.json({ok:true,result:acquireLease(body.leases??{},String(body.runId),String(body.holder))});
    if(action==="evidence") return NextResponse.json({ok:true,chain:buildEvidenceChain(body.evidence??[])});
    if(action==="outcome") return NextResponse.json({ok:true,result:convergeOutcome(body.feedback??[])});
    if(action==="failure") return NextResponse.json({ok:true,result:classifyFailure(body.input??{})});
    if(action==="provider-health") return NextResponse.json({ok:true,result:scoreProviderHealth(body.input??{})});
    if(action==="handoff") return NextResponse.json({ok:true,envelope:buildHandoffEnvelope(body.input)});
    if(action==="scope") return NextResponse.json({ok:true,valid:validateScope(body.scope)});
    if(action==="memory") return NextResponse.json({ok:true,entries:reconcileMemory(body.entries??[])});
    if(action==="certify") return NextResponse.json({ok:true,result:certifyUniversalAgent(body.input)});
    if(action==="readiness") return NextResponse.json({ok:true,result:readinessGate(body.input)});
    return NextResponse.json({ok:false,error:"UNKNOWN_FABRIC_ACTION"},{status:400});
  } catch(error) {
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"FABRIC_OPERATION_FAILED"},{status:400});
  }
}
