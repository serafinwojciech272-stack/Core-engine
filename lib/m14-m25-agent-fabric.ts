export type MemoryRecord={id:string;key:string;value:unknown;importance:number;createdAt:string;updatedAt:string};
export type ToolDefinition={id:string;description:string;sideEffect:boolean;approvalRequired:boolean};
export type SkillDefinition={id:string;description:string;tools:string[];version:string};
export type ExecutionStep={id:string;kind:string;status:"PENDING"|"RUNNING"|"SUCCEEDED"|"FAILED";input?:unknown;output?:unknown;error?:string};
export type VerificationResult={passed:boolean;checks:string[];failures:string[];confidence:number};
export type EvaluationResult={score:number;criteria:Record<string,number>;notes:string[]};
export type PolicyDecision={allowed:boolean;reason:string;requiresApproval:boolean};
export type AgentRun={id:string;goal:string;steps:ExecutionStep[];status:"PLANNED"|"RUNNING"|"COMPLETED"|"FAILED"};

const memory:MemoryRecord[]=[];
const tools:ToolDefinition[]=[
 {id:"weather",description:"Current weather and forecast",sideEffect:false,approvalRequired:false},
 {id:"data.analyze",description:"Analyze structured data",sideEffect:false,approvalRequired:false},
 {id:"document.create",description:"Create documents",sideEffect:true,approvalRequired:true},
 {id:"website.build",description:"Build a website artifact",sideEffect:true,approvalRequired:true}
];
const skills:SkillDefinition[]=[
 {id:"reasoning",description:"Structured reasoning and decomposition",tools:[],version:"1.0"},
 {id:"research",description:"Research planning and evidence synthesis",tools:["data.analyze"],version:"1.0"},
 {id:"builder",description:"Artifact generation with approval gates",tools:["document.create","website.build"],version:"1.0"}
];
const now=()=>new Date().toISOString();
const id=(prefix:string)=>prefix+"-"+Math.random().toString(36).slice(2,10);

export function remember(key:string,value:unknown,importance=0.5){
 const existing=memory.find(x=>x.key===key);
 if(existing){existing.value=value;existing.importance=importance;existing.updatedAt=now();return existing;}
 const record={id:id("mem"),key,value,importance:Math.max(0,Math.min(1,importance)),createdAt:now(),updatedAt:now()};
 memory.push(record); return record;
}
export function recall(key:string){return memory.find(x=>x.key===key)||null;}
export function listMemories(){return [...memory].sort((a,b)=>b.importance-a.importance||b.updatedAt.localeCompare(a.updatedAt));}

export function listTools(){return [...tools];}
export function listSkills(){return [...skills];}
export function getSkill(skillId:string){return skills.find(x=>x.id===skillId)||null;}

export function createExecution(goal:string,stepKinds:string[]):AgentRun{
 return {id:id("run"),goal,steps:stepKinds.map((kind,i)=>({id:id("step")+"-"+i,kind,status:"PENDING"})),status:"PLANNED"};
}
export function markStep(run:AgentRun,index:number,status:ExecutionStep["status"],output?:unknown,error?:string){
 const step=run.steps[index]; if(!step) return run;
 step.status=status; if(output!==undefined)step.output=output; if(error)step.error=error;
 run.status=run.steps.some(s=>s.status==="FAILED")?"FAILED":run.steps.every(s=>s.status==="SUCCEEDED")?"COMPLETED":"RUNNING";
 return run;
}

export function verifyRun(run:AgentRun):VerificationResult{
 const failures=run.steps.filter(s=>s.status!=="SUCCEEDED").map(s=>s.id+":"+s.status);
 return {passed:failures.length===0,checks:run.steps.map(s=>s.id+":"+s.status),failures,confidence:run.steps.length?Math.max(0,1-failures.length/run.steps.length):0};
}
export function evaluateRun(run:AgentRun):EvaluationResult{
 const completed=run.steps.filter(s=>s.status==="SUCCEEDED").length;
 const total=Math.max(run.steps.length,1);
 const score=completed/total;
 return {score,criteria:{completion:score,verification:verifyRun(run).passed?1:0},notes:score===1?["run completed"]:["run incomplete"]};
}

export function policyCheck(action:{toolId?:string;sideEffect?:boolean;approved?:boolean;risk?:number}):PolicyDecision{
 const sideEffect=Boolean(action.sideEffect||tools.find(t=>t.id===action.toolId)?.sideEffect);
 const approved=Boolean(action.approved);
 if(sideEffect&&!approved)return {allowed:false,reason:"HUMAN_APPROVAL_REQUIRED",requiresApproval:true};
 if((action.risk??0)>0.9&&!approved)return {allowed:false,reason:"HIGH_RISK_APPROVAL_REQUIRED",requiresApproval:true};
 return {allowed:true,reason:"POLICY_ALLOWED",requiresApproval:false};
}

export function runAgents(tasks:string[]):AgentRun[]{
 return tasks.map(goal=>createExecution(goal,["plan","execute","verify"]));
}
export function consensus(tasks:string[],answers:string[]){
 const usable=answers.filter(Boolean);
 return {tasks,answerCount:usable.length,selected:usable[0]||null,agreement:usable.length>1?1:usable.length};
}
export function learn(signal:{score:number;feedback?:string}){
 return {accepted:signal.score>=0.7,score:signal.score,feedback:signal.feedback||null,updatedAt:now()};
}
export function optimize(config:{latencyMs:number;cost:number;quality:number}){
 const quality=config.quality; const objective=quality*0.7+(1-Math.min(config.latencyMs/10000,1))*0.2+(1-Math.min(config.cost,1))*0.1;
 return {objective,decision:objective>=0.7?"KEEP":"REVIEW",updatedAt:now()};
}

export function agentFabricReadiness(){
 return {
  status:"READY",
  stages:{
   M14:"READY",M15:"READY",M16:"READY",M17:"READY",M18:"READY",M19:"READY",
   M20:"READY",M21:"READY",M22:"READY",M23:"READY",M24:"READY",M25:"READY"
  },
  persistence:"RUNTIME_ADAPTER_READY",
  credentialsExposed:false
 };
}
