export type VerificationIssue={code:string;severity:"info"|"warning"|"error";message:string};
export type VerificationResult={score:number;passed:boolean;confidence:number;issues:VerificationIssue[];checks:{nonEmpty:boolean;taskCoverage:boolean;uncertaintyHandled:boolean;noFalseExecutionClaim:boolean}};

const CLAIMS=/(done|completed|executed|sent|submitted|deployed|created|saved|booked|wysłano|wykonano|utworzono|zapisano|wdrożono|zarezerwowano)/i;
const STOPWORDS=new Set([
 "return","please","give","provide","write","make","create","show","tell","concise","brief","confirmation","about",
 "the","this","that","with","from","into","your","you","for","and","or","task","requested","system","status","output",
 "proszę","podaj","napisz","zrób","zrob","daj","pokaż","pokaz","krótkie","krótka","potwierdzenie","zadanie","systemu","wynik"
]);

function normalizeWord(word:string){
 return word.toLowerCase().replace(/[^a-ząćęłńóśźż0-9]/gi,"");
}

function taskCoverageScore(task:string,result:string){
 const words=task.split(/\s+/).map(normalizeWord).filter(w=>w.length>4&&!STOPWORDS.has(w)).slice(0,18);
 if(words.length===0) return true;
 const responseWords=new Set(result.split(/\s+/).map(normalizeWord).filter(Boolean));
 const responseText=result.toLowerCase();
 const hits=words.filter(w=>responseWords.has(w)||responseText.includes(w)||responseText.split(/\s+/).some(r=>r.length>=5&&w.length>=5&&r.slice(0,5)===w.slice(0,5))).length;
 return hits>=Math.max(1,Math.ceil(words.length*.15));
}

function hasUnnegatedExecutionClaim(result:string){
 return result.split(/(?<=[.!?;])\s+/).some(sentence=>{
   if(!CLAIMS.test(sentence)) return false;
   return !/(\bnot\b|\bnever\b|\bno\b|\bnie\b|\bbez\b|\bnot yet\b|\bnie zostało\b|\bnie wykonano\b)/i.test(sentence);
 });
}

export function verifyResult(task:string,result:string,meta?:{toolExecuted?:boolean;artifactCreated?:boolean;approvalRequired?:boolean}):VerificationResult{
 const t=task.trim(),r=result.trim(),issues:VerificationIssue[]=[];
 const nonEmpty=r.length>=20;
 const taskCoverage=taskCoverageScore(t,r);
 const uncertaintyHandled=!/(I am not sure|nie wiem|can't verify|nie mogę zweryfikować)/i.test(r)||/verify|source|źród|sprawdź|nie mam dostępu|wymaga weryfikacji/i.test(r);
 const falseExecutionClaim=hasUnnegatedExecutionClaim(r)&&!meta?.toolExecuted&&!meta?.artifactCreated;
 const noFalseExecutionClaim=!falseExecutionClaim;
 if(!nonEmpty)issues.push({code:"EMPTY_OR_TOO_SHORT",severity:"error",message:"Result is empty or too short."});
 if(!taskCoverage)issues.push({code:"LOW_TASK_COVERAGE",severity:"warning",message:"Result has weak semantic/lexical coverage of the requested task."});
 if(!uncertaintyHandled)issues.push({code:"UNQUALIFIED_UNCERTAINTY",severity:"warning",message:"Uncertainty is not explicitly qualified."});
 if(falseExecutionClaim)issues.push({code:"UNVERIFIED_EXECUTION_CLAIM",severity:"error",message:"Response appears to claim external execution without verified tool/artifact evidence."});
 const score=Math.max(0,Math.min(100,(nonEmpty?35:0)+(taskCoverage?30:0)+(uncertaintyHandled?15:0)+(noFalseExecutionClaim?20:0)));
 const confidence=Math.round(score);
 return{score,passed:score>=75&&noFalseExecutionClaim,confidence,issues,checks:{nonEmpty,taskCoverage,uncertaintyHandled,noFalseExecutionClaim}};
}
