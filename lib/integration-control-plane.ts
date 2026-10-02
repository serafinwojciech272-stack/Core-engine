import { createHash } from "node:crypto";

export type IntegrationStatus="ENABLED"|"DISABLED"|"DEGRADED"|"BLOCKED";
export type IntegrationDefinition={integrationId:string;tenantId:string;provider:string;version:string;contractVersion:string;status:IntegrationStatus;allowedActions:string[];riskLevel:"LOW"|"MEDIUM"|"HIGH"|"CRITICAL";rateLimitPerMinute:number;timeoutMs:number;retryLimit:number};
export type IntegrationCredential={credentialId:string;integrationId:string;tenantId:string;secretRef:string;expiresAt:number};
export type IntegrationInvocation={invocationId:string;integrationId:string;tenantId:string;actorId:string;action:string;requestHash:string;idempotencyKey:string;startedAt:number};
export type IntegrationResult={invocationId:string;status:"COMPLETED"|"FAILED"|"TIMEOUT"|"UNKNOWN";responseHash?:string;providerRequestId?:string;retryable:boolean;normalizedError?:string};

const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");

export class IntegrationControlPlane {
 private definitions=new Map<string,IntegrationDefinition>(); private credentials=new Map<string,IntegrationCredential>(); private invocations=new Map<string,IntegrationInvocation>(); private results=new Map<string,IntegrationResult>(); private calls=new Map<string,number[]>();
 register(def:IntegrationDefinition){if(def.rateLimitPerMinute<1||def.timeoutMs<1||def.retryLimit<0)throw new Error("INVALID_INTEGRATION_LIMITS");this.definitions.set(def.integrationId,{...def});return {...def}}
 bindCredential(c:IntegrationCredential){if(c.expiresAt<=Date.now())throw new Error("CREDENTIAL_EXPIRED");const d=this.definitions.get(c.integrationId);if(!d||d.tenantId!==c.tenantId)throw new Error("INTEGRATION_CREDENTIAL_SCOPE");this.credentials.set(c.credentialId,{...c});return {...c}}
 authorize(i:IntegrationInvocation){const d=this.definitions.get(i.integrationId);if(!d)throw new Error("INTEGRATION_NOT_REGISTERED");if(d.tenantId!==i.tenantId)throw new Error("INTEGRATION_TENANT_MISMATCH");if(d.status!=="ENABLED")throw new Error("INTEGRATION_NOT_ENABLED");if(!d.allowedActions.includes(i.action))throw new Error("ACTION_NOT_ALLOWED");if(this.invocations.has(i.invocationId))throw new Error("DUPLICATE_INVOCATION");const now=i.startedAt;const prior=(this.calls.get(i.integrationId)||[]).filter(t=>now-t<60000);if(prior.length>=d.rateLimitPerMinute)throw new Error("INTEGRATION_RATE_LIMIT");this.calls.set(i.integrationId,[...prior,now]);this.invocations.set(i.invocationId,{...i,requestHash:i.requestHash||hash(i)});return {...i}}
 recordResult(r:IntegrationResult){const i=this.invocations.get(r.invocationId);if(!i)throw new Error("INVOCATION_NOT_FOUND");if(r.status==="COMPLETED"&&!r.responseHash)throw new Error("RESPONSE_HASH_REQUIRED");this.results.set(r.invocationId,{...r});return {...r}}
 retryAllowed(invocationId:string){const i=this.invocations.get(invocationId),r=this.results.get(invocationId);if(!i||!r)throw new Error("INVOCATION_RESULT_NOT_FOUND");const d=this.definitions.get(i.integrationId)!;return r.retryable&&r.status!=="COMPLETED"&&d.retryLimit>0}
 normalizeError(code:string,message:string){return {code,message:message.slice(0,500)}}
 hashRequest(input:unknown){return hash(input)}
 snapshot(){return {definitions:[...this.definitions.values()],credentials:[...this.credentials.values()].map(c=>({...c,secretRef:"[REDACTED]"})),invocations:[...this.invocations.values()],results:[...this.results.values()]}}
}