import test from "node:test";
import assert from "node:assert/strict";
import { AIInferenceControlPlane } from "@/lib/ai-inference-control-plane";
import { DataGovernance } from "@/lib/data-governance";
import { AIEvaluationGovernance } from "@/lib/ai-evaluation-governance";

test("M27 enforces registered model, policy and structured output",()=>{
 const p=new AIInferenceControlPlane();
 p.registerModel({modelId:"m1",provider:"p1",modelVersion:"1",contextWindow:10000,supportsStructuredOutput:true,enabled:true});
 p.setPolicy({policyId:"pol",tenantId:"t1",allowedProviders:["p1"],allowedModels:["m1"],maxInputTokens:100,maxOutputTokens:50,requireStructuredOutput:true,version:"1",expiresAt:Date.now()+60000});
 assert.throws(()=>p.authorize({requestId:"r",tenantId:"t1",actorId:"a",modelId:"m1",provider:"p1",promptVersion:"1",contextVersion:"1",inputTokens:10,maxOutputTokens:10,requestHash:"x",resourceBudgetId:"b"}),/STRUCTURED_SCHEMA_REQUIRED/);
 p.authorize({requestId:"r",tenantId:"t1",actorId:"a",modelId:"m1",provider:"p1",promptVersion:"1",contextVersion:"1",inputTokens:10,maxOutputTokens:10,schemaId:"s",requestHash:"x",resourceBudgetId:"b"});
 assert.throws(()=>p.recordResult({requestId:"r",status:"COMPLETED",provider:"p1",modelId:"m1",modelVersion:"1",inputTokens:10,outputTokens:10,cachedTokens:0,latencyMs:10,cost:1,structured:false,validationErrors:[]}),/STRUCTURED_OUTPUT_REQUIRED/);
});

test("M28 blocks restricted data from model input",()=>{
 const d=new DataGovernance();
 d.setPolicy({policyId:"p",tenantId:"t1",classification:"CONFIDENTIAL",retentionMs:1000,allowExport:false,allowModelInput:true,version:"1"});
 assert.throws(()=>d.assertAccess("t1","SENSITIVE","MODEL_INPUT"),/DATA_CLASSIFICATION_BLOCKED/);
 assert.throws(()=>d.assertAccess("t1","CONFIDENTIAL","EXPORT"),/DATA_EXPORT_BLOCKED/);
});

test("M29 evaluation produces signal, not deployment",()=>{
 const e=new AIEvaluationGovernance();
 e.start({runId:"r",definitionId:"d",version:"1",mode:"REGRESSION",status:"RUNNING",metrics:[],sampleSize:20});
 e.complete("r",[{name:"schema",value:1,threshold:1,passed:true}]);
 const s=e.signal("r","PLANNER");
 assert.equal(s.eligibleForProposal,true);
 assert.doesNotThrow(()=>e.assertNoDirectDeployment(s));
 assert.throws(()=>e.assertNoDirectDeployment({...s,target:"PROD_DIRECT_PLANNER"}),/EVALUATION_CANNOT_DEPLOY/);
});
