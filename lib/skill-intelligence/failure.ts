export type FailureClass="TRANSIENT"|"DEPENDENCY"|"POLICY"|"VALIDATION"|"EXECUTION"|"UNKNOWN";
export type FailureAssessment={class:FailureClass;retryable:boolean;severity:"LOW"|"MEDIUM"|"HIGH"|"CRITICAL";reason:string};
export function classifySkillFailure(input:{code:string;attempt:number;maxAttempts:number}):FailureAssessment{
 const code=input.code.toUpperCase();
 if(code.includes("TIMEOUT")||code.includes("RATE_LIMIT")) return {class:"TRANSIENT",retryable:input.attempt<input.maxAttempts,severity:"MEDIUM",reason:"Transient infrastructure condition."};
 if(code.includes("DEPENDENCY")||code.includes("ADAPTER")) return {class:"DEPENDENCY",retryable:false,severity:"HIGH",reason:"Required dependency is unavailable."};
 if(code.includes("POLICY")||code.includes("APPROVAL")) return {class:"POLICY",retryable:false,severity:"CRITICAL",reason:"Governance gate rejected execution."};
 if(code.includes("VALID")) return {class:"VALIDATION",retryable:false,severity:"MEDIUM",reason:"Input or output validation failed."};
 if(code.includes("EXEC")) return {class:"EXECUTION",retryable:false,severity:"HIGH",reason:"Skill execution failed."};
 return {class:"UNKNOWN",retryable:false,severity:"HIGH",reason:"Unclassified failure must not be retried automatically."};
}
