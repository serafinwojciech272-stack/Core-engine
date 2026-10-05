import { createHash } from "node:crypto";

export const UNIVERSAL_SKILL_INTELLIGENCE_VERSION="usi-v1" as const;
export const USI_STAGES=[
{id:176,name:"SKILL_CONTRACT_ENGINE",phase:"CONTRACT"},
{id:177,name:"SKILL_MANIFEST_V2",phase:"DISCOVERY"},
{id:178,name:"SKILL_DISCOVERY_ENGINE",phase:"DISCOVERY"},
{id:179,name:"SEMANTIC_SKILL_MATCHING",phase:"MATCHING"},
{id:180,name:"SKILL_COMPOSITION_ENGINE",phase:"COMPOSITION"},
{id:181,name:"SKILL_DEPENDENCY_GRAPH",phase:"COMPOSITION"},
{id:182,name:"SKILL_PRECONDITIONS_ENGINE",phase:"VALIDATION"},
{id:183,name:"SKILL_POSTCONDITIONS_ENGINE",phase:"VALIDATION"},
{id:184,name:"SKILL_VERIFICATION_ADAPTER",phase:"VERIFICATION"},
{id:185,name:"SKILL_EVIDENCE_GENERATOR",phase:"EVIDENCE"},
{id:186,name:"SKILL_FAILURE_MODEL",phase:"RECOVERY"},
{id:187,name:"SKILL_RECOVERY_STRATEGY",phase:"RECOVERY"},
{id:188,name:"SKILL_FALLBACK_GRAPH",phase:"RECOVERY"},
{id:189,name:"SKILL_COST_MODEL",phase:"OPTIMIZATION"},
{id:190,name:"SKILL_RISK_MODEL",phase:"GOVERNANCE"},
{id:191,name:"SKILL_PERFORMANCE_MEMORY",phase:"LEARNING"},
{id:192,name:"SKILL_SUCCESS_PREDICTOR",phase:"LEARNING"},
{id:193,name:"SKILL_SELECTION_OPTIMIZER",phase:"OPTIMIZATION"},
{id:194,name:"SKILL_AB_EVALUATION",phase:"EVALUATION"},
{id:195,name:"SKILL_LEARNING_LOOP",phase:"LEARNING"},
{id:196,name:"SKILL_VERSIONING",phase:"LIFECYCLE"},
{id:197,name:"SKILL_REGRESSION_DETECTION",phase:"QUALITY"},
{id:198,name:"SKILL_CERTIFICATION",phase:"CERTIFICATION"},
{id:199,name:"UNIVERSAL_SKILL_REGISTRY",phase:"REGISTRY"},
{id:200,name:"UNIVERSAL_SKILL_CONTROL_PLANE",phase:"CONTROL"}
] as const;

export type SkillRisk="LOW"|"MEDIUM"|"HIGH"|"CRITICAL";
export type SkillStatus="DRAFT"|"ACTIVE"|"DEPRECATED"|"BLOCKED";
export type SkillManifest={
 id:string; name:string; version:string; description:string; domain:string;
 tags:string[]; inputs:string[]; outputs:string[]; preconditions:string[]; postconditions:string[];
 actions:string[]; providers:string[]; dependencies:string[]; permissions:string[];
 risk:SkillRisk; estimatedCost:number; estimatedLatencyMs:number; status:SkillStatus;
 verification:string[]; fallbacks:string[]; metadata:Record<string,string>;
};
export type SkillPerformance={skillId:string;version:string;runs:number;successes:number;failures:number;avgScore:number;avgCost:number;avgLatencyMs:number;lastOutcome:number;updatedAt:string};
export type SkillRegistry={version:"skill-registry-v1";skills:SkillManifest[];performance:SkillPerformance[];updatedAt:string};

const now=()=>new Date().toISOString();
const clean=(xs:unknown[],max=50)=>[...new Set(xs.map(String).map(x=>x.trim()).filter(Boolean))].slice(0,max);
const tokens=(x:string)=>x.toLowerCase().split(/[^a-z0-9ąćęłńóśźż_]+/i).filter(Boolean);
const sha=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const clamp=(n:number,a=0,b=1)=>Math.max(a,Math.min(b,n));

export function createSkillManifest(input:Partial<SkillManifest>&Pick<SkillManifest,"id"|"name"|"description"|"domain">):SkillManifest{
 if(!input.id.trim()||!input.name.trim()) throw new Error("SKILL_ID_AND_NAME_REQUIRED");
 return {id:input.id.trim(),name:input.name.trim(),version:input.version||"1.0.0",description:input.description.trim().slice(0,1000),domain:input.domain.trim().slice(0,100),
 tags:clean(input.tags||[],30),inputs:clean(input.inputs||[],30),outputs:clean(input.outputs||[],30),preconditions:clean(input.preconditions||[],30),
 postconditions:clean(input.postconditions||[],30),actions:clean(input.actions||[],50),providers:clean(input.providers||[],20),
 dependencies:clean(input.dependencies||[],30),permissions:clean(input.permissions||[],30),risk:input.risk||"MEDIUM",
 estimatedCost:Number.isFinite(input.estimatedCost)?Math.max(0,input.estimatedCost as number):0,
 estimatedLatencyMs:Number.isFinite(input.estimatedLatencyMs)?Math.max(0,input.estimatedLatencyMs as number):0,
 status:input.status||"DRAFT",verification:clean(input.verification||[],30),fallbacks:clean(input.fallbacks||[],20),metadata:{...(input.metadata||{})}};
}

export function validateSkillContract(s:SkillManifest){
 const errors:string[]=[];
 if(!/^[-a-z0-9_.]+$/i.test(s.id)) errors.push("INVALID_SKILL_ID");
 if(!/^\d+\.\d+\.\d+$/.test(s.version)) errors.push("INVALID_SEMVER");
 if(!s.description||!s.domain) errors.push("DESCRIPTION_OR_DOMAIN_MISSING");
 if(!s.inputs.length||!s.outputs.length) errors.push("INPUT_OUTPUT_CONTRACT_MISSING");
 if(!s.actions.length) errors.push("ACTIONS_MISSING");
 if(s.risk==="CRITICAL"&&!s.permissions.length) errors.push("CRITICAL_PERMISSION_CONTRACT_MISSING");
 return {valid:errors.length===0,errors,integrity:sha({id:s.id,version:s.version,inputs:s.inputs,outputs:s.outputs,actions:s.actions,permissions:s.permissions})};
}

export function discoverSkills(registry:SkillRegistry,query:string,domain?:string){
 const q=new Set(tokens(query));
 return registry.skills.filter(s=>s.status==="ACTIVE"&&(!domain||s.domain===domain)).map(skill=>{
   const corpus=tokens([skill.id,skill.name,skill.description,skill.domain,...skill.tags,...skill.inputs,...skill.outputs,...skill.actions].join(" "));
   const overlap=corpus.filter(t=>q.has(t)).length;
   const domainBoost=domain&&skill.domain===domain?3:0;
   return {skill,score:overlap+domainBoost};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
}

export function semanticSkillMatch(skill:SkillManifest,objective:string){
 const q=new Set(tokens(objective)), corpus=tokens([skill.name,skill.description,skill.domain,...skill.tags,...skill.inputs,...skill.outputs].join(" "));
 const overlap=corpus.filter(t=>q.has(t)).length;
 return clamp(overlap/Math.max(1,q.size)*1.5);
}

export function composeSkills(skills:SkillManifest[]){
 const selected=skills.filter(s=>s.status==="ACTIVE");
 const dependencies=clean(selected.flatMap(s=>s.dependencies),100);
 const conflicts=selected.flatMap(s=>s.permissions.filter(p=>p.startsWith("conflict:")));
 return {skills:selected.map(s=>s.id),dependencies,conflicts,requiresApproval:selected.some(s=>s.risk==="HIGH"||s.risk==="CRITICAL"),integrity:sha(selected.map(s=>({id:s.id,version:s.version})))};
}

export function buildDependencyGraph(skills:SkillManifest[]){
 const graph:Record<string,string[]>={};
 for(const s of skills) graph[s.id]=s.dependencies.filter(d=>skills.some(x=>x.id===d));
 return graph;
}

export function checkPreconditions(skill:SkillManifest,context:Set<string>){
 const missing=skill.preconditions.filter(x=>!context.has(x));
 return {ready:missing.length===0,missing};
}
export function checkPostconditions(skill:SkillManifest,observed:Set<string>){
 const missing=skill.postconditions.filter(x=>!observed.has(x));
 return {satisfied:missing.length===0,missing};
}
export function verifySkill(skill:SkillManifest,observed:string[],evidence:string[]){
 const post=checkPostconditions(skill,new Set(observed));
 const evidenceOk=skill.verification.length===0||skill.verification.every(v=>evidence.includes(v));
 return {verified:post.satisfied&&evidenceOk,postconditions:post,evidenceSufficient:evidenceOk};
}
export function generateSkillEvidence(skill:SkillManifest,observed:string[],sources:string[]){
 return {skillId:skill.id,version:skill.version,observed:clean(observed,100),sources:clean(sources,50),integrity:sha({skill:skill.id,version:skill.version,observed,sources}),createdAt:now()};
}
export function classifySkillFailure(code:string,retryable=true){
 const c=code.toUpperCase();
 if(!retryable)return {class:"NON_RETRYABLE",strategy:"ESCALATE"} as const;
 if(/AUTH|PERMISSION|SCOPE/.test(c))return {class:"AUTHORIZATION",strategy:"REAPPROVE"} as const;
 if(/TIMEOUT|429|RATE|NETWORK/.test(c))return {class:"TRANSIENT",strategy:"FALLBACK_OR_RETRY"} as const;
 if(/PRECONDITION|INPUT|SCHEMA/.test(c))return {class:"CONTRACT",strategy:"REPLAN"} as const;
 return {class:"UNKNOWN",strategy:"REVIEW"} as const;
}
export function recoveryStrategy(failure:ReturnType<typeof classifySkillFailure>){
 return failure.strategy==="FALLBACK_OR_RETRY"?["RETRY","FALLBACK","REPLAN"]:failure.strategy==="REAPPROVE"?["REVOKE","APPROVAL","RETRY"]:failure.strategy==="REPLAN"?["REPLAN","REVALIDATE"]:["ESCALATE"];
}
export function buildFallbackGraph(skills:SkillManifest[]){return Object.fromEntries(skills.map(s=>[s.id,s.fallbacks.filter(f=>skills.some(x=>x.id===f))]));}
export function estimateSkillCost(skills:SkillManifest[]){return skills.reduce((n,s)=>n+s.estimatedCost,0);}
export function scoreSkillRisk(skills:SkillManifest[]){
 const weights:{[K in SkillRisk]:number}={LOW:.1,MEDIUM:.35,HIGH:.7,CRITICAL:1};
 return clamp(skills.reduce((n,s)=>n+weights[s.risk],0)/Math.max(1,skills.length));
}
export function updateSkillPerformance(p:SkillPerformance,outcome:number,cost:number,latency:number):SkillPerformance{
 const runs=p.runs+1, successes=p.successes+(outcome>=.5?1:0), failures=runs-successes;
 return {...p,runs,successes,failures,avgScore:(p.avgScore*p.runs+clamp(outcome))/runs,avgCost:(p.avgCost*p.runs+Math.max(0,cost))/runs,avgLatencyMs:(p.avgLatencyMs*p.runs+Math.max(0,latency))/runs,lastOutcome:clamp(outcome),updatedAt:now()};
}
export function predictSkillSuccess(perf:SkillPerformance|undefined){
 if(!perf||perf.runs===0)return .5;
 const base=perf.avgScore, reliability=perf.successes/perf.runs, sample=Math.min(1,perf.runs/20);
 return clamp(base*.65+reliability*.35)*(.7+.3*sample);
}
export function optimizeSkillSelection(candidates:Array<{skill:SkillManifest;semantic:number;performance?:SkillPerformance}>){
 return candidates.map(c=>({skill:c.skill,score:clamp(c.semantic*.5+predictSkillSuccess(c.performance)*.3+(1-c.skill.estimatedCost/Math.max(1,Math.max(...candidates.map(x=>x.skill.estimatedCost),1)))*.2)})).sort((a,b)=>b.score-a.score);
}
export function evaluateSkillAB(a:SkillPerformance,b:SkillPerformance){
 const confidence=Math.min(1,(a.runs+b.runs)/40), delta=a.avgScore-b.avgScore;
 return {winner:Math.abs(delta)<.03?"TIE":delta>0?"A":"B",delta,confidence};
}
export function learnSkill(registry:SkillRegistry,skillId:string,version:string,outcome:number,cost:number,latency:number){
 const current=registry.performance.find(p=>p.skillId===skillId&&p.version===version)||{skillId,version,runs:0,successes:0,failures:0,avgScore:0,avgCost:0,avgLatencyMs:0,lastOutcome:0,updatedAt:now()};
 const next=updateSkillPerformance(current,outcome,cost,latency);
 return {...registry,performance:[...registry.performance.filter(p=>!(p.skillId===skillId&&p.version===version)),next],updatedAt:now()};
}
export function detectSkillRegression(current:SkillPerformance,baseline:SkillPerformance){
 return {regressed:current.runs>=5&&baseline.runs>=5&&current.avgScore<baseline.avgScore*.85,delta:current.avgScore-baseline.avgScore};
}
export function bumpSkillVersion(skill:SkillManifest,version:string){
 if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error("INVALID_SEMVER");
 return {...skill,version,status:"DRAFT" as const};
}
export function certifySkill(skill:SkillManifest,performance?:SkillPerformance){
 const contract=validateSkillContract(skill);
 const certified=contract.valid&&skill.status==="ACTIVE"&&skill.verification.length>0&&(!performance||performance.runs>=3);
 return {certified,contract,checks:{active:skill.status==="ACTIVE",verificationDefined:skill.verification.length>0,sufficientEvidence:!performance||performance.runs>=3}};
}
export function createSkillRegistry(skills:SkillManifest[]=[]):SkillRegistry{return{version:"skill-registry-v1",skills,performance:[],updatedAt:now()};}
export function registerSkill(registry:SkillRegistry,skill:SkillManifest){
 const contract=validateSkillContract(skill);if(!contract.valid)throw new Error("SKILL_CONTRACT_INVALID:"+contract.errors.join(","));
 return {...registry,skills:[...registry.skills.filter(s=>s.id!==skill.id),skill],updatedAt:now()};
}
export function controlPlaneDecision(input:{objective:string;skills:SkillManifest[];context:Set<string>;approved:boolean;budget:number}){
 const preconditions=input.skills.map(s=>checkPreconditions(s,input.context));
 const cost=estimateSkillCost(input.skills), risk=scoreSkillRisk(input.skills), composition=composeSkills(input.skills);
 const allowed=input.approved&&cost<=input.budget&&risk<.9&&preconditions.every(x=>x.ready)&&!composition.conflicts.length;
 return {allowed,reason:allowed?"SKILL_EXECUTION_ALLOWED":!input.approved?"HUMAN_APPROVAL_REQUIRED":cost>input.budget?"SKILL_BUDGET_EXCEEDED":risk>=.9?"SKILL_RISK_TOO_HIGH":composition.conflicts.length?"SKILL_CONFLICT":"SKILL_PRECONDITION_MISSING",cost,risk,preconditions,composition,integrity:sha({objective:input.objective,skills:input.skills.map(s=>s.id),approved:input.approved,budget:input.budget})};
}
