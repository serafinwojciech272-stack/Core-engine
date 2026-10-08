export type ModelRole = "fast" | "balanced" | "expert" | "judge";
export type ModelCapability = "general" | "reasoning" | "coding" | "research" | "documents" | "structured" | "multimodal" | "agentic" | "long-context";
export type ModelProfile = { id:string; provider:"openrouter"; family:string; role:ModelRole; capabilities:ModelCapability[]; complexityMin:number; complexityMax:number; costClass:"low"|"medium"|"high"; contextWindow:number; supportsVision:boolean; supportsStructuredOutput:boolean; enabled:boolean };

const DEFAULT_MODELS:ModelProfile[]=[
{id:"openai/gpt-5.6-luna",provider:"openrouter",family:"openai",role:"balanced",capabilities:["general","reasoning","structured","long-context"],complexityMin:1,complexityMax:8,costClass:"medium",contextWindow:200000,supportsVision:true,supportsStructuredOutput:true,enabled:true},
{id:"anthropic/claude-sonnet-5.5",provider:"openrouter",family:"anthropic",role:"expert",capabilities:["general","reasoning","coding","research","documents","structured","agentic","long-context"],complexityMin:5,complexityMax:10,costClass:"high",contextWindow:200000,supportsVision:true,supportsStructuredOutput:true,enabled:true},
{id:"x-ai/grok-4.7",provider:"openrouter",family:"xai",role:"expert",capabilities:["general","reasoning","coding","research","agentic","long-context"],complexityMin:5,complexityMax:10,costClass:"high",contextWindow:131072,supportsVision:true,supportsStructuredOutput:true,enabled:true},
{id:"moonshotai/kimi-k2.7-code",provider:"openrouter",family:"kimi",role:"expert",capabilities:["reasoning","coding","agentic","long-context"],complexityMin:6,complexityMax:10,costClass:"high",contextWindow:262144,supportsVision:false,supportsStructuredOutput:true,enabled:true},
{id:"google/gemini-3.8-flash",provider:"openrouter",family:"google",role:"fast",capabilities:["general","reasoning","research","structured","multimodal","agentic"],complexityMin:2,complexityMax:8,costClass:"medium",contextWindow:1000000,supportsVision:true,supportsStructuredOutput:true,enabled:true}
];

function env(name:string){return process.env[name]?.trim()||"";}
function configuredIds(){return [env("OPENROUTER_MODEL"),...env("OPENROUTER_FALLBACK_MODELS").split(",")].map(v=>v.trim()).filter(Boolean);}
function customProfile(id:string):ModelProfile{return{id,provider:"openrouter",family:id.split("/")[0]||"custom",role:"balanced",capabilities:["general","reasoning","structured"],complexityMin:1,complexityMax:8,costClass:"medium",contextWindow:128000,supportsVision:false,supportsStructuredOutput:true,enabled:true};}

export function modelRegistry(){
  const configured=configuredIds();
  const known=new Set(DEFAULT_MODELS.map(model=>model.id));
  const custom=configured.filter(id=>!known.has(id)).map(customProfile);
  const selected=new Set(configured);
  const models=[...DEFAULT_MODELS,...custom];
  return models.map(model=>({...model,enabled:selected.size===0?model.enabled:selected.has(model.id)}));
}

export function getModelProfile(id:string){return modelRegistry().find(model=>model.id===id);}
export function modelsForCapability(capability:ModelCapability,complexity=5){
  return modelRegistry().filter(model=>model.enabled&&model.capabilities.includes(capability)&&complexity>=model.complexityMin&&complexity<=model.complexityMax)
    .sort((a,b)=>{const order:Record<ModelRole,number>={fast:1,balanced:2,expert:3,judge:4};return order[a.role]-order[b.role]||a.costClass.localeCompare(b.costClass)||a.id.localeCompare(b.id);});
}
export function modelsForDomain(domain:string,complexity:number){
  const capability:ModelCapability=domain==="coding"?"coding":domain==="research"?"research":domain==="high-stakes"?"reasoning":"general";
  return modelsForCapability(capability,complexity).map(model=>model.id);
}
export function modelRegistryReadiness(){
  const models=modelRegistry();
  return{status:models.length?"READY":"EMPTY",provider:"openrouter",count:models.length,enabledCount:models.filter(model=>model.enabled).length,configuredPrimary:env("OPENROUTER_MODEL")||null,configuredFallbacks:env("OPENROUTER_FALLBACK_MODELS").split(",").map(v=>v.trim()).filter(Boolean)};
}
