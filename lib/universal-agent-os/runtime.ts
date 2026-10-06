export type Risk="LOW"|"MEDIUM"|"HIGH"|"CRITICAL";
export type Lifecycle="PLANNED"|"APPROVAL"|"PERMITTED"|"RUNNING"|"VERIFYING"|"OUTCOME"|"LEARNING"|"BLOCKED"|"FAILED";
export type RuntimePolicy={maxRetries:number;timeoutMs:number;budget:number;maxRisk:Risk;killSwitch:boolean};
export type RuntimeTask={tenantId:string;missionId:string;taskId:string;agentId:string;toolId?:string;input:Record<string,unknown>;risk:Risk;attempt:number;correlationId:string};
const rank:Record<Risk,number>={LOW:1,MEDIUM:2,HIGH:3,CRITICAL:4};
export function authorizeRuntime(t:RuntimeTask,p:RuntimePolicy){if(p.killSwitch)return {allowed:false,reason:"KILL_SWITCH"};if(rank[t.risk]>rank[p.maxRisk])return {allowed:false,reason:"RISK_LIMIT"};return {allowed:true,reason:"POLICY_ALLOW"}}
export function nextLifecycle(s:Lifecycle,event:"APPROVE"|"PERMIT"|"RUN"|"VERIFY"|"SUCCESS"|"LEARN"|"FAIL"|"BLOCK"){const m:Record<string,Lifecycle>={APPROVE:"APPROVAL",PERMIT:"PERMITTED",RUN:"RUNNING",VERIFY:"VERIFYING",SUCCESS:"OUTCOME",LEARN:"LEARNING",FAIL:"FAILED",BLOCK:"BLOCKED"};return m[event]}
export function retryDecision(attempt:number,p:RuntimePolicy){return attempt<p.maxRetries}
export function timeoutAt(start:number,p:RuntimePolicy){return start+p.timeoutMs}
export function budgetAllowed(cost:number,p:RuntimePolicy){return cost>=0&&cost<=p.budget}
export function circuitState(failures:number,threshold:number){return failures>=threshold?"OPEN":"CLOSED"}
export function idempotencyKey(t:RuntimeTask){return [t.tenantId,t.missionId,t.taskId,t.correlationId].join(":")}