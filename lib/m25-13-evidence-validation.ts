import type { EvidenceRecord } from "@/lib/m25-12-evidence-contract";
export type EvidenceValidation={valid:boolean;fresh:boolean;qualityScore:number;confidenceScore:number;missing:string[];conflicts:string[]};
export function validateEvidence(records:readonly EvidenceRecord[],now=Date.now()):EvidenceValidation{
 const missing:string[]=[];const conflicts:string[]=[];if(!records.length)missing.push("EVIDENCE_EMPTY");
 for(const r of records){if(!r.id||!r.source)missing.push("EVIDENCE_ID_OR_SOURCE_MISSING");if(Number.isNaN(Date.parse(r.observedAt)))missing.push("EVIDENCE_TIMESTAMP_INVALID");if(r.quality<0||r.quality>1||r.confidence<0||r.confidence>1)missing.push("EVIDENCE_SCORE_OUT_OF_RANGE");if(r.freshnessHours!==undefined&&now-Date.parse(r.observedAt)>r.freshnessHours*3600000)missing.push(`EVIDENCE_STALE:${r.id}`);}
 const byKey=new Map<string,EvidenceRecord>();for(const r of records){const k=`${r.domain}:${r.id}`;const prior=byKey.get(k);if(prior&&JSON.stringify(prior.value)!==JSON.stringify(r.value))conflicts.push(`EVIDENCE_CONFLICT:${r.id}`);else byKey.set(k,r);}
 const qualityScore=records.length?records.reduce((s,r)=>s+r.quality,0)/records.length:0,confidenceScore=records.length?records.reduce((s,r)=>s+r.confidence,0)/records.length:0;
 return {valid:missing.length===0&&conflicts.length===0,fresh:!missing.some(x=>x.startsWith("EVIDENCE_STALE")),qualityScore,confidenceScore,missing:[...new Set(missing)],conflicts:[...new Set(conflicts)]};
}
