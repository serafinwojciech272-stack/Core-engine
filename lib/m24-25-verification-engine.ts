import type { RecoveryExecutionEvent } from "@/lib/recovery-executor";
import type { VerificationOutcome, LearningSignal } from "@/lib/m24-25-verification-contract";

export type RecoveryVerificationInput = { tenantId:string; recoveryKey:string; execution:RecoveryExecutionEvent; expectedState:Record<string,unknown>; observedState:Record<string,unknown> };
export type RecoveryVerificationResult = { tenantId:string; recoveryKey:string; executionId:string; action:RecoveryExecutionEvent["action"]; outcome:VerificationOutcome; learningSignal:LearningSignal; matchedKeys:string[]; mismatchedKeys:string[]; verificationHash:string; verifiedAt:string; reason:string };

export function verifyRecoveryExecution(input:RecoveryVerificationInput):RecoveryVerificationResult {
 if(!input.tenantId||!input.recoveryKey||!input.execution.executionId) throw new Error("RECOVERY_VERIFICATION_INPUT_INVALID");
 if(input.execution.tenantId!==input.tenantId||input.execution.recoveryKey!==input.recoveryKey) throw new Error("RECOVERY_VERIFICATION_SCOPE_MISMATCH");
 if(input.execution.status!=="EXECUTED") throw new Error("RECOVERY_EXECUTION_NOT_EXECUTED");
 const keys=[...new Set([...Object.keys(input.expectedState),...Object.keys(input.observedState)])].sort();
 const matchedKeys=keys.filter(k=>JSON.stringify(input.expectedState[k])===JSON.stringify(input.observedState[k]));
 const mismatchedKeys=keys.filter(k=>JSON.stringify(input.expectedState[k])!==JSON.stringify(input.observedState[k]));
 const outcome:VerificationOutcome=keys.length===0?"UNVERIFIED":mismatchedKeys.length===0?"SUCCESS":matchedKeys.length?"PARTIAL":"FAILED";
 const learningSignal:LearningSignal=outcome==="SUCCESS"?"POSITIVE":outcome==="UNVERIFIED"?"NEUTRAL":"NEGATIVE";
 return {tenantId:input.tenantId,recoveryKey:input.recoveryKey,executionId:input.execution.executionId,action:input.execution.action,outcome,learningSignal,matchedKeys,mismatchedKeys,verificationHash:input.execution.executionHash,verifiedAt:new Date().toISOString(),reason:outcome==="SUCCESS"?"EXPECTED_STATE_MATCHED":outcome==="PARTIAL"?"EXPECTED_STATE_PARTIALLY_MATCHED":outcome==="FAILED"?"EXPECTED_STATE_MISMATCH":"NO_VERIFIABLE_STATE"};
}
