export type AttackClass="PROMPT_INJECTION"|"TOOL_ABUSE"|"PRIVILEGE_ESCALATION"|"DATA_EXFILTRATION"|"REPLAY"|"TENANT_ESCAPE"|"RESOURCE_EXHAUSTION"|"SUPPLY_CHAIN";
export type SecurityDecision="ALLOW"|"CHALLENGE"|"BLOCK";
export type SecuritySignal={signalId:string;tenantId:string;actorId:string;attackClass:AttackClass;severity:"LOW"|"MEDIUM"|"HIGH"|"CRITICAL";evidence:string[];decision:SecurityDecision;policyVersion:string;createdAt:number};
export type SecurityPolicy={tenantId:string;version:string;enabledClasses:AttackClass[];blockSeverities:("LOW"|"MEDIUM"|"HIGH"|"CRITICAL")[];maxToolCalls:number;maxDelegationDepth:number;nonceTtlMs:number};

const severities={LOW:0,MEDIUM:1,HIGH:2,CRITICAL:3} as const;
const normalize=(s:string)=>s.replace(/[\u0000-\u001f\u007f]/g," ").trim();

export class AdversarialSecurityControlPlane {
 private policies=new Map<string,SecurityPolicy>();
 private nonces=new Map<string,number>();
 private signals=new Map<string,SecuritySignal>();
 private toolCounts=new Map<string,number>();
 setPolicy(p:SecurityPolicy){if(p.maxToolCalls<0||p.maxDelegationDepth<0||p.nonceTtlMs<1)throw new Error("INVALID_SECURITY_POLICY");this.policies.set(p.tenantId,{...p});return {...p};}
 issueNonce(key:string,now=Date.now()){const n=`${key}:${now}:${Math.random().toString(36).slice(2)}`;this.nonces.set(n,now+this.policy(key).nonceTtlMs);return n;}
 consumeNonce(key:string,nonce:string,now=Date.now()){const expiry=this.nonces.get(nonce);if(!expiry||expiry<now||!nonce.startsWith(`${key}:`))throw new Error("INVALID_OR_EXPIRED_NONCE");this.nonces.delete(nonce);return true;}
 authorizeTool(tenantId:string,actorId:string,toolId:string,depth:number,nonce:string,now=Date.now()){const p=this.policy(tenantId);if(depth>p.maxDelegationDepth)throw new Error("DELEGATION_DEPTH_BLOCKED");this.consumeNonce(actorId,nonce,now);const k=`${tenantId}:${actorId}`;const count=(this.toolCounts.get(k)??0)+1;if(count>p.maxToolCalls)throw new Error("TOOL_RATE_LIMIT");this.toolCounts.set(k,count);return {allowed:true,toolId,count};}
 inspect(tenantId:string,actorId:string,input:string,attackClass:AttackClass,severity:"LOW"|"MEDIUM"|"HIGH"|"CRITICAL",evidence:string[],policyVersion:string):SecuritySignal{const p=this.policy(tenantId);const clean=evidence.map(normalize);const enabled=p.enabledClasses.includes(attackClass);const blocked=enabled&&p.blockSeverities.some(s=>severities[s]>=severities[severity]);const decision:SecurityDecision=blocked?"BLOCK":enabled?"CHALLENGE":"ALLOW";const s={signalId:`sec_${Date.now()}_${this.signals.size}`,tenantId,actorId,attackClass,severity,evidence:clean,decision,policyVersion,createdAt:Date.now()};this.signals.set(s.signalId,s);return {...s};}
 assertTenant(tenantId:string,resourceTenantId:string){if(tenantId!==resourceTenantId)throw new Error("TENANT_BOUNDARY_VIOLATION");return true;}
 assertNoSecrets(text:string){if(/(?:sk-[A-Za-z0-9_-]{20,}|service_role|Authorization:\s*Bearer\s+[A-Za-z0-9._-]+)/i.test(text))throw new Error("SECRET_EXFILTRATION_BLOCKED");return true;}
 private policy(tenantId:string){const p=this.policies.get(tenantId);if(!p)throw new Error("SECURITY_POLICY_NOT_FOUND");return p;}
 snapshot(){return {policies:[...this.policies.values()],signals:[...this.signals.values()]};}
}
