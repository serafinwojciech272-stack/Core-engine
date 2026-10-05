import { canonicalHash } from "@/lib/m25-11-canonical-hash";
export type ProvenanceItem={id:string;source:string;observedAt:string;claim:string;citation?:string};
export type ProvenanceBundle={items:ProvenanceItem[];hash:string};
export function buildProvenance(items:ProvenanceItem[]):ProvenanceBundle{return {items,hash:canonicalHash(items)};}
export function verifyProvenance(bundle:ProvenanceBundle):boolean{return canonicalHash(bundle.items)===bundle.hash;}
