import { createHash } from "node:crypto";

export type TrustLevel="TRUSTED"|"LIMITED"|"UNTRUSTED";
export type KnowledgeStatus="ACTIVE"|"EXPIRED"|"RETRACTED"|"QUARANTINED";
export type KnowledgeObject={
  knowledgeId:string; tenantId:string; sourceId:string; sourceType:string;
  content:string; contentHash:string; version:number; trustLevel:TrustLevel;
  authority:number; sourceTimestamp:number; validUntil?:number; status:KnowledgeStatus;
};

export type RetrievalRequest={
  retrievalId:string; tenantId:string; actorId:string; query:string;
  maxResults:number; maxContextChars:number; allowedKnowledgeTypes?:string[];
  freshnessMaxAgeMs?:number;
};

export type RetrievalResult={
  knowledgeId:string; version:number; score:number; authority:number;
  freshness:number; provenance:{sourceId:string;contentHash:string};
};

export type ContextPackage={
  contextId:string; tenantId:string; retrievalId:string; references:RetrievalResult[];
  content:string; omitted:number; contextHash:string; version:number;
};

const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");

function tokens(s:string){return new Set(s.toLowerCase().split(/[^a-z0-9ąćęłńóśźż]+/i).filter(Boolean));}

export class KnowledgeContextFabric {
  private objects=new Map<string,KnowledgeObject[]>();

  ingest(input:Omit<KnowledgeObject,"contentHash"|"status"|"version"> & Partial<Pick<KnowledgeObject,"version"|"status">>){
    if(!input.tenantId||!input.sourceId||!input.content.trim()) throw new Error("INVALID_KNOWLEDGE");
    if(input.trustLevel==="UNTRUSTED" && input.status==="ACTIVE") throw new Error("UNTRUSTED_ACTIVE_KNOWLEDGE");
    const list=this.objects.get(input.knowledgeId)??[];
    const version=(input.version??((list.at(-1)?.version??0)+1));
    if(list.some(v=>v.version===version)) throw new Error("KNOWLEDGE_VERSION_EXISTS");
    const object:KnowledgeObject={...input,version,status:input.status??"QUARANTINED",contentHash:hash(input.content)};
    list.push(object); this.objects.set(input.knowledgeId,list);
    return {...object};
  }

  activate(knowledgeId:string,version:number){
    const o=this.require(knowledgeId,version);
    if(o.trustLevel==="UNTRUSTED") throw new Error("UNTRUSTED_KNOWLEDGE");
    o.status="ACTIVE"; return {...o};
  }

  retract(knowledgeId:string,version:number){const o=this.require(knowledgeId,version);o.status="RETRACTED";return {...o};}

  retrieve(req:RetrievalRequest):RetrievalResult[]{
    const now=Date.now(), q=tokens(req.query);
    const rows:[KnowledgeObject,number][]=[];
    for(const versions of this.objects.values()){
      const o=versions.at(-1)!;
      if(o.tenantId!==req.tenantId||o.status!=="ACTIVE") continue;
      if(o.validUntil && o.validUntil<now) continue;
      if(req.freshnessMaxAgeMs && now-o.sourceTimestamp>req.freshnessMaxAgeMs) continue;
      const text=tokens(o.content);
      let overlap=0; for(const t of q) if(text.has(t)) overlap++;
      const score=q.size ? overlap/q.size : 0;
      if(score>0) rows.push([o,score]);
    }
    return rows.sort((a,b)=>(b[1]+b[0].authority/100)-(a[1]+a[0].authority/100)).slice(0,Math.max(0,req.maxResults)).map(([o,score])=>({
      knowledgeId:o.knowledgeId,version:o.version,score,authority:o.authority,
      freshness:req.freshnessMaxAgeMs?Math.max(0,1-(now-o.sourceTimestamp)/req.freshnessMaxAgeMs):1,
      provenance:{sourceId:o.sourceId,contentHash:o.contentHash}
    }));
  }

  buildContext(req:RetrievalRequest):ContextPackage{
    const results=this.retrieve(req);
    let content="",omitted=0;
    for(const r of results){
      const o=this.require(r.knowledgeId,r.version);
      const block=`[SOURCE ${o.sourceId} | TRUST ${o.trustLevel} | VERSION ${o.version}]\n${o.content}\n`;
      if(content.length+block.length>req.maxContextChars){omitted++;continue;}
      content+=block;
    }
    const contextHash=hash({tenantId:req.tenantId,retrievalId:req.retrievalId,references:results,content});
    return {contextId:`ctx_${crypto.randomUUID()}`,tenantId:req.tenantId,retrievalId:req.retrievalId,references:results,content,omitted,contextHash,version:1};
  }

  snapshot(){return [...this.objects.values()].flat().map(v=>({...v}));}
  private require(id:string,version:number){const o=this.objects.get(id)?.find(v=>v.version===version);if(!o)throw new Error("KNOWLEDGE_NOT_FOUND");return o;}
}
