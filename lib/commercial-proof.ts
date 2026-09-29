import type { Mission } from "@/lib/engine";
import type { MissionReport } from "@/lib/mission-report";

export type ProofEvent={missionId:string;eventType:string};

export type CommercialProofMetrics = {
  missionCount:number;
  completedMissionCount:number;
  learnedMissionCount:number;
  approvalRate:number|null;
  executionRate:number|null;
  verifiedOutcomeRate:number|null;
  predictionAccuracy:number|null;
  unverifiedOutcomeRate:number|null;
  averageProvenanceCoverage:number|null;
  valueEvidenceRate:number|null;
  averageMissionCycleMs:number|null;
  roiAvailable:boolean;
  timeToFirstMissionMs:number|null;
  timeToValueMs:number|null;
  billingEvidenceAvailable:boolean;
  readiness:"PARTIAL"|"READY";
  missingEvidence:string[];
};

function ratio(n:number,d:number){return d? n/d:null}
function avg(values:number[]){return values.length?values.reduce((a,b)=>a+b,0)/values.length:null}

export function buildCommercialProofMetrics(input:{missions:Mission[];events:ProofEvent[];reports:MissionReport[]}):CommercialProofMetrics{
  const reports=input.reports;
  const completed=input.missions.filter(m=>m.state==="COMPLETED"||m.state==="LEARNED").length;
  const learned=input.missions.filter(m=>m.state==="LEARNED").length;
  const approvalCandidates=input.missions.filter(m=>input.events.some(e=>e.missionId===m.id&&e.eventType==="STATE_CHANGED"&&e.fromState==="AWAITING_APPROVAL"));
  const approved=input.missions.filter(m=>input.events.some(e=>e.missionId===m.id&&e.eventType==="STATE_CHANGED"&&e.toState==="APPROVED"));\n  const executed=input.missions.filter(m=>input.events.some(e=>e.missionId===m.id&&(e.eventType==="CAPABILITY_EXECUTED"||e.eventType==="EXECUTION_RECORDED")));
  const resolved=reports.filter(r=>r.outcome.predicted!==undefined&&r.outcome.actual!==undefined);
  const verified=reports.filter(r=>r.outcome.quality==="VERIFIED");
  const cycles=reports.map(r=>r.commercial.timeToValueMs).filter((x):x is number=>typeof x==="number");
  const missingEvidence:string[]=[];
  if(!reports.some(r=>r.outcome.actual!==undefined))missingEvidence.push("ACTUAL_OUTCOME");
  if(!reports.some(r=>r.commercial.valueEvidenceAvailable))missingEvidence.push("VALUE_EVIDENCE");
  if(!reports.some(r=>r.outcome.predicted!==undefined))missingEvidence.push("PREDICTION");
  missingEvidence.push("FINANCIAL_BASELINE_AND_ROI");
  missingEvidence.push("BILLING_SUBSCRIPTION_EVIDENCE");
  const first=input.missions.map(m=>Date.parse(m.createdAt)).filter(Number.isFinite).sort((a,b)=>a-b)[0];
  return{
    missionCount:input.missions.length,
    completedMissionCount:completed,
    learnedMissionCount:learned,
    approvalRate:ratio(approvalCandidates.length,input.missions.length),
    executionRate:ratio(executed.length,approved.length),
    verifiedOutcomeRate:ratio(verified.length,resolved.length),
    predictionAccuracy:resolved.length?ratio(reports.filter(r=>r.summary.predictionCorrect===true).length,resolved.length):null,
    unverifiedOutcomeRate:reports.length?ratio(reports.filter(r=>r.outcome.quality==="UNVERIFIED").length,reports.length):null,
    averageProvenanceCoverage:avg(reports.map(r=>r.evidence.provenanceCoverage)),
    valueEvidenceRate:reports.length?ratio(reports.filter(r=>r.commercial.valueEvidenceAvailable).length,reports.length):null,
    averageMissionCycleMs:avg(cycles),
    roiAvailable:false,
    timeToFirstMissionMs:null,
    timeToValueMs:cycles.length?Math.min(...cycles):null,
    billingEvidenceAvailable:false,
    readiness:missingEvidence.length===0?"READY":"PARTIAL",
    missingEvidence:[...new Set(missingEvidence)]
  };
}
