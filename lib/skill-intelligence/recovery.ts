import type {FailureAssessment} from "./failure";
export type RecoveryAction="RETRY"|"FALLBACK"|"REPLAN"|"ESCALATE"|"STOP";
export type RecoveryDecision={action:RecoveryAction;reason:string};
export function decideRecovery(failure:FailureAssessment,hasFallback:boolean):RecoveryDecision{
 if(failure.retryable)return {action:"RETRY",reason:"Retry budget remains and failure is transient."};
 if(hasFallback)return {action:"FALLBACK",reason:"Primary skill failed and an approved fallback exists."};
 if(failure.class==="DEPENDENCY"||failure.class==="POLICY")return {action:"ESCALATE",reason:"Governance or dependency failure requires controlled intervention."};
 if(failure.class==="VALIDATION")return {action:"REPLAN",reason:"Validated inputs/outputs require a new plan."};
 return {action:"STOP",reason:"No safe autonomous recovery path exists."};
}
