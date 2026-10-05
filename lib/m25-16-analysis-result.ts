import { canonicalHash } from "@/lib/m25-11-canonical-hash";
import type { CoreEngineDomain } from "@/lib/m25-01-domain-router";
import type { DataQuality } from "@/lib/m25-14-data-quality";
export type AnalysisResult={status:"COMPLETE"|"INSUFFICIENT_DATA"|"BLOCKED";domains:CoreEngineDomain[];observed:string[];inferred:string[];assumptions:string[];limitations:string[];dataQuality:DataQuality;analysisHash:string};
export function buildAnalysisResult(input:Omit<AnalysisResult,"analysisHash">):AnalysisResult{return {...input,analysisHash:canonicalHash(input)};}
