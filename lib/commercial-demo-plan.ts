import type {BusinessAudit} from "@/lib/business-audit";

export type CommercialDemoPlan={
  version:"1.0";
  objective:string;
  trustGate:BusinessAudit["trustGate"];
  phases:Array<{id:"AUDIT"|"BUSINESS_STATE"|"OPPORTUNITIES"|"KPI_DISCOVERY"|"GROWTH_DECISION"|"APPROVAL";status:"COMPLETE"|"READY"|"BLOCKED";purpose:string;requiredInputs:string[]}>;
  requiredBusinessInputs:string[];
  expectedOutcome:string;
  approvalRequired:true;
  evidenceRefs:string[];
};

export function buildCommercialDemoPlan(audit:BusinessAudit):CommercialDemoPlan{
  const blocked=audit.trustGate==="BLOCK";
  const needsKpi=[
    "primary_business_goal",
    "baseline_kpi",
    "target_kpi",
    "measurement_window",
    "execution_constraints"
  ];
  const phases:CommercialDemoPlan["phases"]=[
    {id:"AUDIT",status:"COMPLETE",purpose:"Establish public-web technical evidence and trust posture.",requiredInputs:["business_url"]},
    {id:"BUSINESS_STATE",status:blocked?"BLOCKED":"READY",purpose:"Combine audit evidence with customer-supplied operating KPIs.",requiredInputs:needsKpi},
    {id:"OPPORTUNITIES",status:blocked?"BLOCKED":"READY",purpose:"Turn verified gaps into candidate business opportunities.",requiredInputs:["business_url","kpi_context"]},
    {id:"KPI_DISCOVERY",status:blocked?"BLOCKED":"READY",purpose:"Define baseline, target and measurement method before intervention.",requiredInputs:needsKpi},
    {id:"GROWTH_DECISION",status:blocked?"BLOCKED":"READY",purpose:"Pass the existing deterministic decision and risk-gate path.",requiredInputs:["signals","evidence"]},
    {id:"APPROVAL",status:blocked?"BLOCKED":"READY",purpose:"Require explicit human approval before any governed side effect.",requiredInputs:["mission","expected_outcome","risk_summary"]}
  ];
  const expectedOutcome=audit.opportunities.length
    ? "Evidence-backed improvement plan with measurable KPI baseline and target; no value is claimed before measurement."
    : "KPI-driven growth experiment with verified baseline and target; no value is claimed before measurement.";
  return{
    version:"1.0",
    objective:"Convert a public business audit into a governed, measurable path to the first value-producing mission.",
    trustGate:audit.trustGate,
    phases,
    requiredBusinessInputs:needsKpi,
    expectedOutcome,
    approvalRequired:true,
    evidenceRefs:audit.signals.map(s=>s.source+":"+s.name)
  };
}
