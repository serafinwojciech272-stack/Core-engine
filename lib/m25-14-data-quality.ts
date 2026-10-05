import type { EvidenceValidation } from "@/lib/m25-13-evidence-validation";
export type DataQualityBand="POOR"|"FAIR"|"GOOD"|"EXCELLENT";
export type DataQuality={score:number;band:DataQualityBand;dimensions:{completeness:number;freshness:number;quality:number;consistency:number};failClosed:boolean;reasons:string[]};
export function assessDataQuality(input:{requiredCount:number;providedCount:number;evidence:EvidenceValidation}):DataQuality{
 const completeness=input.requiredCount?Math.min(1,input.providedCount/input.requiredCount):0,freshness=input.evidence.fresh?1:.35,quality=input.evidence.qualityScore,consistency=input.evidence.conflicts.length?.2:1;
 const score=Math.round((completeness*.3+freshness*.25+quality*.25+consistency*.2)*100)/100,band:DataQualityBand=score>=.9?"EXCELLENT":score>=.75?"GOOD":score>=.5?"FAIR":"POOR";
 return {score,band,dimensions:{completeness,freshness,quality,consistency},failClosed:!input.evidence.valid||score<.5,reasons:[...(input.evidence.missing.length?["MISSING_OR_INVALID_EVIDENCE"]:[]),...(input.evidence.conflicts.length?["CONFLICTING_EVIDENCE"]:[]),...(input.evidence.fresh?[]:["STALE_EVIDENCE"])]};
}
