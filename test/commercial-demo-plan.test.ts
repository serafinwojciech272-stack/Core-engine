import test from "node:test";
import assert from "node:assert/strict";
import {buildCommercialDemoPlan} from "@/lib/commercial-demo-plan";
import type {BusinessAudit} from "@/lib/business-audit";

const audit=(trustGate:BusinessAudit["trustGate"]):BusinessAudit=>({url:"https://example.com",httpStatus:200,trustGate,trustReasons:[],signals:[{name:"website_http_status",value:"200",source:"core.web-audit.v1"}],evidence:{},opportunities:["Improve conversion evidence"],});
test("demo plan requires governed approval and KPI evidence",()=>{
 const plan=buildCommercialDemoPlan(audit("PASS"));
 assert.equal(plan.approvalRequired,true);
 assert.equal(plan.phases.find(x=>x.id==="GROWTH_DECISION")?.status,"READY");
 assert.ok(plan.requiredBusinessInputs.includes("baseline_kpi"));
});
test("blocked trust gate blocks downstream phases without claiming value",()=>{
 const plan=buildCommercialDemoPlan(audit("BLOCK"));
 assert.equal(plan.phases.find(x=>x.id==="BUSINESS_STATE")?.status,"BLOCKED");
 assert.match(plan.expectedOutcome,/no value is claimed/i);
});
