import type { CoreEngineDomain } from "@/lib/m25-01-domain-router";
export type EvidenceKind="PRIMARY"|"SECONDARY"|"MODEL_INPUT"|"USER_PROVIDED";
export type EvidenceRecord={id:string;domain:CoreEngineDomain;kind:EvidenceKind;source:string;observedAt:string;quality:number;confidence:number;freshnessHours?:number;citation?:string;value?:unknown};
export function createEvidenceRecord(input:Omit<EvidenceRecord,"quality"|"confidence">&{quality?:number;confidence?:number}):EvidenceRecord{return {...input,quality:Math.max(0,Math.min(1,input.quality??.5)),confidence:Math.max(0,Math.min(1,input.confidence??.5))};}
