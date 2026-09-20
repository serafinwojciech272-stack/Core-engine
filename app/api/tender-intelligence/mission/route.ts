import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { buildAuditChain } from "@/lib/audit-chain";
import { persistDecisionMission, getPersistedTenderCase, linkTenderCaseMission, persistTenderCase, storageMode } from "@/lib/storage";
import { fingerprintDataset, type TenderDataset } from "@/lib/tender-intelligence-engine";
import type { Decision, Mission } from "@/lib/engine";

export const runtime = "nodejs";

export async function POST(request:Request){
 const guard=guardMutation(request,"tender-mission"); if(guard)return guard;
 try{
  if(storageMode()!=="supabase") return NextResponse.json({ok:false,error:"DURABLE_STORAGE_REQUIRED"},{status:503});
  const body=JSON.parse(await request.text()||"{}") as {caseId?:string};
  const caseId=String(body.caseId||"");
  if(!caseId)return NextResponse.json({ok:false,error:"CASE_ID_REQUIRED"},{status:400});
  const row=await getPersistedTenderCase(caseId);
  if(!row)return NextResponse.json({ok:false,error:"TENDER_CASE_NOT_FOUND"},{status:404});
  const dataset=row.dataset as unknown as TenderDataset;
  const decision:Decision={
   id:crypto.randomUUID(),
   diagnosis:`Tender ${caseId}: ${dataset.bidReadiness.status}; ${dataset.risks.length} risks; ${dataset.questions.filter(q=>q.priority==="P1").length} P1 questions.`,
   recommendation:"Resolve document-derived blockers, validate pricing inputs, obtain approval, then execute the bid-readiness mission.",
   confidence:Math.max(0.2,Math.min(0.99,dataset.bidReadiness.score/100)),
   priority:dataset.bidReadiness.status==="READY"?"MEDIUM":"HIGH",
   evidence:[
    "tender-case="+caseId,
    "dataset-fingerprint="+String(row.fingerprint),
    "documents="+String(dataset.documentCount),
    "risks="+String(dataset.risks.length),
    "blockers="+dataset.bidReadiness.blockers.join("|")
   ],
   reasoningSource:"DETERMINISTIC_RULES",
   riskGate:dataset.bidReadiness.status==="READY"?"PASS":"CAUTION"
  };
  const mission:Mission={id:crypto.randomUUID(),decisionId:decision.id,objective:"Prepare Zabrze tender bid to evidence-backed, price-ready and submission-ready state.",state:"AWAITING_APPROVAL",kpi:"bid_readiness_score",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),executionCount:0};
  const persisted=await persistDecisionMission(decision,mission,"1.0");
  const chain=await buildAuditChain({signals:{caseId,datasetFingerprint:row.fingerprint},decision,mission,trace:["DOCUMENT_INTAKE","NORMALIZE","CROSS_DOCUMENT","RISK_REGISTER","QUESTION_PACK","BID_READINESS","MISSION_CREATED","AWAITING_APPROVAL"]});
  await linkTenderCaseMission(caseId,mission.id);
  const augmented={...dataset,audit:{algorithm:process.env.AUDIT_SIGNING_KEY?"HMAC-SHA256 chained audit v2":"SHA-256 chained audit v1",integrity:process.env.AUDIT_SIGNING_KEY?"SIGNED":"UNSIGNED",head:chain.at(-1)?.hash,chain},missionId:mission.id};
  await persistTenderCase(caseId,String(row.title||"Zabrze tender"),fingerprintDataset(augmented as TenderDataset),augmented as unknown as Record<string,unknown>);
  return NextResponse.json({ok:true,caseId,decision,mission,persisted,stage:["DOCUMENT_INTAKE","NORMALIZE","CROSS_DOCUMENT","RISK_REGISTER","QUESTION_PACK","BID_READINESS","MISSION_CREATED","AWAITING_APPROVAL"],audit:chain,persistence:"supabase",durable:true});
 }catch(error){console.error("[core-engine] tender mission creation failed",error);return NextResponse.json({ok:false,error:error instanceof Error?error.message:"TENDER_MISSION_FAILED"},{status:503})}
}