export type ToolEvidence={executed:boolean;artifactCreated:boolean;tool:string|null;status:"EXECUTED"|"NOT_EXECUTED"|"FAILED";reason?:string};

const TOOL_INTENTS=/(stwórz|utwórz|wygeneruj|zbuduj|przekształć|przeksztalc|konwertuj|edytuj|retusz|analizuj|zwizualizuj|generate|build|create|convert|edit|analy[sz]e|visuali[sz]e)/i;
const ARTIFACT_INTENTS=/(pdf|docx?|xlsx?|csv|arkusz|dokument|stron[ay]|website|obraz|image|graf|chart|dashboard|wideo|video)/i;

export function toolExecutionRequirement(task:string){
  const requires=TOOL_INTENTS.test(task)&&ARTIFACT_INTENTS.test(task);
  return{requiresTool:requires,requiresArtifact:requires&&ARTIFACT_INTENTS.test(task)};
}

export function gateToolEvidence(task:string,evidence:Partial<ToolEvidence>):ToolEvidence{
  const req=toolExecutionRequirement(task);
  const executed=Boolean(evidence.executed);
  const artifactCreated=Boolean(evidence.artifactCreated);
  if(req.requiresTool&&!executed)return{executed:false,artifactCreated:false,tool:evidence.tool??null,status:"NOT_EXECUTED",reason:"TOOL_EXECUTION_REQUIRED"};
  if(req.requiresArtifact&&!artifactCreated)return{executed,artifactCreated:false,tool:evidence.tool??null,status:"FAILED",reason:"ARTIFACT_EVIDENCE_REQUIRED"};
  return{executed,artifactCreated,tool:evidence.tool??null,status:executed?"EXECUTED":"NOT_EXECUTED"};
}

export function sanitizeExecutionClaim(text:string,evidence:ToolEvidence){
  if(evidence.status==="EXECUTED"||evidence.artifactCreated)return text;
  return text.replace(/\b(done|completed|executed|sent|submitted|deployed|created|saved|booked)\b/gi,"prepared");
}
