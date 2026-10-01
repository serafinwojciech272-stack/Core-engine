import { createHash } from "node:crypto";

export type InferenceStatus="REQUESTED"|"AUTHORIZED"|"COMPLETED"|"FAILED"|"BLOCKED";
export type ModelPolicy={policyId:string;tenantId:string;allowedProviders:string[];allowedModels:string[];maxInputTokens:number;maxOutputTokens:number;requireStructuredOutput:boolean;version:string;expiresAt:number};
export type ModelDefinition={modelId:string;provider:string;modelVersion:string;contextWindow:number;supportsStructuredOutput:boolean;enabled:boolean};
export type InferenceRequest={requestId:string;tenantId:string;actorId:string;missionId?:string;modelId:string;provider:string;promptVersion:string;contextVersion:string;inputTokens:number;maxOutputTokens:number;schemaId?:string;secretRefs?:string[];requestHash:string;resourceBudgetId:string};
export type InferenceResult={requestId:string;status:InferenceStatus;provider:string;modelId:string;modelVersion:string;inputTokens:number;outputTokens:number;cachedTokens:number;latencyMs:number;cost:number;responseHash?:string;structured:boolean;validationErrors:string[]};
export type InferenceEvaluation={requestId:string;quality?:number;grounded?:boolean;schemaValid:boolean;verified:boolean;reasonCodes:string[]};

const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");

export class AIInferenceControlPlane {
  private models=new Map<string,ModelDefinition>();
  private policies=new Map<string,ModelPolicy>();
  private requests=new Map<string,InferenceRequest>();
  private results=new Map<string,InferenceResult>();

  registerModel(model:ModelDefinition){if(!model.enabled)throw new Error("MODEL_DISABLED");this.models.set(model.modelId,{...model});return {...model};}
  setPolicy(policy:ModelPolicy){if(policy.expiresAt<=Date.now())throw new Error("POLICY_EXPIRED");this.policies.set(policy.tenantId,{...policy});return {...policy};}
  authorize(req:InferenceRequest):InferenceRequest{
    const m=this.models.get(req.modelId), p=this.policies.get(req.tenantId);
    if(!m)throw new Error("MODEL_NOT_REGISTERED");
    if(!p)throw new Error("MODEL_POLICY_NOT_FOUND");
    if(p.expiresAt<=Date.now())throw new Error("MODEL_POLICY_EXPIRED");
    if(!p.allowedProviders.includes(req.provider)||!p.allowedModels.includes(req.modelId))throw new Error("MODEL_NOT_AUTHORIZED");
    if(req.provider!==m.provider||!m.enabled)throw new Error("PROVIDER_MODEL_MISMATCH");
    if(req.inputTokens<0||req.inputTokens>p.maxInputTokens||req.maxOutputTokens<1||req.maxOutputTokens>p.maxOutputTokens)throw new Error("TOKEN_LIMIT");
    if(p.requireStructuredOutput&&!req.schemaId)throw new Error("STRUCTURED_SCHEMA_REQUIRED");
    if(req.secretRefs?.length)throw new Error("SECRET_BOUNDARY");
    if(this.requests.has(req.requestId))throw new Error("DUPLICATE_INFERENCE_REQUEST");
    this.requests.set(req.requestId,{...req}); return {...req};
  }
  recordResult(result:InferenceResult){
    const req=this.requests.get(result.requestId); if(!req)throw new Error("INFERENCE_REQUEST_NOT_FOUND");
    if(result.status==="COMPLETED"&&!result.responseHash)throw new Error("RESPONSE_HASH_REQUIRED");
    if(result.status==="COMPLETED"&&req.schemaId&&!result.structured)throw new Error("STRUCTURED_OUTPUT_REQUIRED");
    this.results.set(result.requestId,{...result}); return {...result};
  }
  evaluate(requestId:string, evaluation:InferenceEvaluation){
    const result=this.results.get(requestId); if(!result)throw new Error("INFERENCE_RESULT_NOT_FOUND");
    const passed=evaluation.schemaValid&&evaluation.verified&&result.status==="COMPLETED";
    return {...evaluation,requestId,verified:passed,reasonCodes:passed?["INFERENCE_VERIFIED"]:["INFERENCE_NOT_VERIFIED"]};
  }
  requestHash(input:unknown){return hash(input);}
  snapshot(){return {models:[...this.models.values()],policies:[...this.policies.values()],requests:[...this.requests.values()],results:[...this.results.values()]};}
}
