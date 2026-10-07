export type VerificationIssue={code:string;severity:"info"|"warning"|"error";message:string};
export type VerificationResult={score:number;passed:boolean;confidence:number;issues:VerificationIssue[];checks:{nonEmpty:boolean;taskCoverage:boolean;uncertaintyHandled:boolean;noFalseExecutionClaim:boolean}};
const CLAIMS=/(done|completed|executed|sent|submitted|deployed|created|saved|booked|wysłano|wykonano|utworzono|zapisano|wdrożono|zarezerwowano)/i;
export function verifyResult(task:string,result:string,meta?:{toolExecuted?:boolean;artifactCreated?:boolean;approvalRequired?:boolean}):VerificationResult{
 const t=task.trim(),r=result.trim(),issues:VerificationIssue[]=[];
 const nonEmpty=r.length>=20;
 const taskWords=t.toLowerCase().split(/\s+/).filter(w=>w.length>4).slice(0,18);
 const hits=taskWords.filter(w=>r.toLowerCase().includes(w)).length;
 const taskCoverage=taskWords.length===0||hits>=Math.max(1,Math.ceil(taskWords.length*.18));
 const uncertaintyHandled=!/(I am not sure|nie wiem|can't verify|nie mogę zweryfikować)/i.test(r)||/verify|source|źród|sprawdź|nie mam dostępu|wymaga weryfikacji/i.test(r);
 const falseExecutionClaim=CLAIMS.test(r)&&!meta?.toolExecuted&&!meta?.artifactCreated;
 const noFalseExecutionClaim=!falseExecutionClaim;
 if(!nonEmpty)issues.push({code:"EMPTY_OR_TOO_SHORT",severity:"error",message:"Result is empty or too short."});
 if(!taskCoverage)issues.push({code:"LOW_TASK_COVERAGE",severity:"warning",message:"Result has weak lexical coverage of the requested task."});
 if(!uncertaintyHandled)issues.push({code:"UNQUALIFIED_UNCERTAINTY",severity:"warning",message:"Uncertainty is not explicitly qualified."});
 if(falseExecutionClaim)issues.push({code:"UNVERIFIED_EXECUTION_CLAIM",severity:"error",message:"Response appears to claim external execution without verified tool/artifact evidence."});
 const score=Math.max(0,Math.min(100,(nonEmpty?35:0)+(taskCoverage?30:0)+(uncertaintyHandled?15:0)+(noFalseExecutionClaim?20:0)));
 const confidence=Math.round(score);
 return{score,passed:score>=75&&noFalseExecutionClaim,confidence,issues,checks:{nonEmpty,taskCoverage,uncertaintyHandled,noFalseExecutionClaim}};
}