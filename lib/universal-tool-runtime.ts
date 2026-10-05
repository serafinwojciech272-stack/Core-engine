import { createHash } from "node:crypto";

export const UNIVERSAL_TOOL_RUNTIME_VERSION="utr-v1" as const;
export const UTR_STAGES=[
{id:201,name:"TOOL_CONTRACT_REGISTRY",phase:"CONTRACT"},
{id:202,name:"MCP_ADAPTER",phase:"INTEROPERABILITY"},
{id:203,name:"BROWSER_RESEARCH_RUNTIME",phase:"BROWSER"},
{id:204,name:"COMPUTER_USE_BOUNDARY",phase:"COMPUTER"},
{id:205,name:"CODE_EXECUTION_SANDBOX",phase:"SANDBOX"},
{id:206,name:"FILE_SYSTEM_RUNTIME",phase:"FILES"},
{id:207,name:"DATABASE_TOOL_RUNTIME",phase:"DATA"},
{id:208,name:"API_CONNECTOR_RUNTIME",phase:"INTEGRATION"},
{id:209,name:"EXTERNAL_SERVICE_CONNECTOR",phase:"INTEGRATION"},
{id:210,name:"SECRET_CREDENTIAL_BROKER",phase:"SECURITY"},
{id:211,name:"DATA_CLASSIFICATION_GATE",phase:"SECURITY"},
{id:212,name:"TENANT_ISOLATION_GUARD",phase:"SECURITY"},
{id:213,name:"TOOL_PERMISSION_MODEL",phase:"GOVERNANCE"},
{id:214,name:"TOOL_RISK_SCORING",phase:"GOVERNANCE"},
{id:215,name:"TOOL_COST_TELEMETRY",phase:"OBSERVABILITY"},
{id:216,name:"TOOL_LATENCY_TELEMETRY",phase:"OBSERVABILITY"},
{id:217,name:"TOOL_FAILURE_CLASSIFICATION",phase:"RECOVERY"},
{id:218,name:"TOOL_FALLBACK_ROUTER",phase:"RECOVERY"},
{id:219,name:"TOOL_RESULT_VERIFICATION",phase:"VERIFICATION"},
{id:220,name:"TOOL_EVIDENCE_CAPTURE",phase:"EVIDENCE"},
{id:221,name:"TOOL_IDEMPOTENCY",phase:"RUNTIME"},
{id:222,name:"TOOL_RATE_LIMIT_GUARD",phase:"GOVERNANCE"},
{id:223,name:"TOOL_AUDIT_EXPORT",phase:"AUDIT"},
{id:224,name:"TOOL_VERSION_COMPATIBILITY",phase:"LIFECYCLE"},
{id:225,name:"UNIVERSAL_TOOL_CONTROL_PLANE",phase:"CONTROL"}
] as const;

export type ToolRisk="LOW"|"MEDIUM"|"HIGH"|"CRITICAL";
export type ToolContract={id:string;name:string;version:string;kind:string;permissions:string[];risk:ToolRisk;estimatedCost:number;timeoutMs:number;tenantScoped:boolean;requiresApproval:boolean;inputSchema:string[];outputSchema:string[];providers:string[];fallbackToolIds:string[]};
export type ToolInvocation={toolId:string;runId:string;tenantId:string;idempotencyKey:string;approved:boolean;estimatedCost:number;createdAt:string};
const now=()=>new Date().toISOString();
const sha=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const clean=(v:unknown[],n=30)=>[...new Set(v.map(String).map(x=>x.trim()).filter(Boolean))].slice(0,n);

export function createToolContract(input:Partial<ToolContract>&Pick<ToolContract,"id"|"name"|"kind">):ToolContract{
 if(!input.id?.trim()||!input.name?.trim())throw new Error("TOOL_ID_AND_NAME_REQUIRED");
 const risk=input.risk??"MEDIUM";
 return {id:input.id.trim(),name:input.name.trim(),version:input.version||"1.0.0",kind:input.kind.trim(),permissions:clean(input.permissions||["read"],20),risk,estimatedCost:Math.max(0,Number(input.estimatedCost??0)),timeoutMs:Math.max(100,Math.min(86_400_000,Math.floor(input.timeoutMs??120000))),tenantScoped:input.tenantScoped!==false,requiresApproval:input.requiresApproval!==false||risk==="HIGH"||risk==="CRITICAL",inputSchema:clean(input.inputSchema||[],30),outputSchema:clean(input.outputSchema||[],30),providers:clean(input.providers||[],20),fallbackToolIds:clean(input.fallbackToolIds||[],20)};
}
export function validateToolContract(tool:ToolContract){
 const errors:string[]=[];
 if(!tool.id||!tool.name||!tool.version)errors.push("IDENTITY_INVALID");
 if(!tool.kind)errors.push("KIND_REQUIRED");
 if(!tool.tenantScoped)errors.push("TENANT_SCOPE_REQUIRED");
 if(tool.estimatedCost<0||!Number.isFinite(tool.estimatedCost))errors.push("COST_INVALID");
 if(tool.timeoutMs<100)errors.push("TIMEOUT_INVALID");
 if(tool.risk==="CRITICAL"&&!tool.requiresApproval)errors.push("CRITICAL_APPROVAL_REQUIRED");
 return {valid:errors.length===0,errors};
}
export function classifyData(input:string){const text=input.toLowerCase();if(/password|secret|token|api[_ -]?key|private[_ -]?key/.test(text))return "SECRET";if(/pesel|nip|email|phone|address|personal/.test(text))return "PERSONAL";if(/payment|bank|card|iban/.test(text))return "FINANCIAL";return "PUBLIC";}
export function authorizeTool(tool:ToolContract,input:{tenantId:string;approved:boolean;budget:number;estimatedCost?:number;dataClass?:string;providerAvailable?:boolean}){
 const validation=validateToolContract(tool); if(!validation.valid)return{allowed:false,reason:"TOOL_CONTRACT_INVALID"};
 if(!input.tenantId.trim())return{allowed:false,reason:"TENANT_REQUIRED"};
 const cost=input.estimatedCost??tool.estimatedCost;
 if(cost>input.budget)return{allowed:false,reason:"TOOL_BUDGET_EXCEEDED"};
 if(input.providerAvailable===false)return{allowed:false,reason:"PROVIDER_UNAVAILABLE"};
 if(tool.requiresApproval&&!input.approved)return{allowed:false,reason:"HUMAN_APPROVAL_REQUIRED"};
 if(tool.permissions.includes("write")&&input.dataClass==="SECRET")return{allowed:false,reason:"SECRET_WRITE_BLOCKED"};
 return{allowed:true,reason:"TOOL_EXECUTION_ALLOWED"};
}
export function buildToolInvocation(tool:ToolContract,input:{runId:string;tenantId:string;approved:boolean;estimatedCost?:number;nonce:string}):ToolInvocation{
 if(!input.runId.trim()||!input.tenantId.trim())throw new Error("RUN_AND_TENANT_REQUIRED");
 const estimatedCost=Math.max(0,input.estimatedCost??tool.estimatedCost);
 return{toolId:tool.id,runId:input.runId,tenantId:input.tenantId,idempotencyKey:"tool_"+sha({tool:tool.id,runId:input.runId,tenantId:input.tenantId,nonce:input.nonce}).slice(0,32),approved:input.approved,estimatedCost,createdAt:now()};
}
export function verifyToolResult(tool:ToolContract,result:{ok:boolean;outputs:string[];evidence:string[]}){
 const outputs=new Set(result.outputs);const evidence=new Set(result.evidence);
 const missing=tool.outputSchema.filter(x=>!outputs.has(x));
 return{verified:result.ok&&missing.length===0&&evidence.size>0,missingOutputs:missing,evidenceCount:evidence.size};
}
export function buildToolEvidence(tool:ToolContract,invocation:ToolInvocation,result:unknown){const payload={toolId:tool.id,toolVersion:tool.version,invocation,result,capturedAt:now()};return{...payload,integrity:sha(payload)};}
export function classifyToolFailure(code:string,retryable=true){const c=code.toUpperCase();if(!retryable)return{class:"NON_RETRYABLE",action:"REPLAN"} as const;if(/429|RATE|TIMEOUT|UNAVAILABLE/.test(c))return{class:"TRANSIENT",action:"FALLBACK"} as const;if(/AUTH|FORBIDDEN|SCOPE/.test(c))return{class:"AUTH_POLICY",action:"REAPPROVAL"} as const;return{class:"UNKNOWN",action:"REVIEW"} as const;}
export function buildToolFallbackGraph(tools:ToolContract[]){return Object.fromEntries(tools.map(t=>[t.id,t.fallbackToolIds.filter(id=>tools.some(x=>x.id===id))]));}
export function rateLimitDecision(input:{used:number;limit:number;requested:number}){return{allowed:input.used+input.requested<=input.limit,remaining:Math.max(0,input.limit-input.used-input.requested)};}
export function exportToolAudit(events:Array<Record<string,unknown>>){const payload={version:UNIVERSAL_TOOL_RUNTIME_VERSION,events:events.slice(-1000),exportedAt:now()};return{...payload,integrity:sha(payload)};}
