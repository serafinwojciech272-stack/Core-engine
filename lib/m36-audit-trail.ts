import { canonicalHash } from "@/lib/m25-11-canonical-hash";
export type AuditEvent={tenantId:string;requestId:string;eventType:string;payload:Record<string,unknown>;eventHash:string};
export function createAuditEvent(input:Omit<AuditEvent,"eventHash">):AuditEvent{return {...input,eventHash:canonicalHash(input)};}
export function verifyAuditEvent(e:AuditEvent):boolean{return canonicalHash({tenantId:e.tenantId,requestId:e.requestId,eventType:e.eventType,payload:e.payload})===e.eventHash;}
