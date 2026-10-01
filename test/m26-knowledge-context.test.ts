import test from "node:test";
import assert from "node:assert/strict";
import { KnowledgeContextFabric } from "@/lib/knowledge-context-fabric";

test("M26 keeps untrusted knowledge quarantined and tenant isolated",()=>{
  const k=new KnowledgeContextFabric();
  k.ingest({knowledgeId:"k1",tenantId:"t1",sourceId:"s1",sourceType:"EXTERNAL",content:"Gliwice market research",trustLevel:"UNTRUSTED",authority:10,sourceTimestamp:Date.now()});
  k.ingest({knowledgeId:"k2",tenantId:"t2",sourceId:"s2",sourceType:"INTERNAL",content:"Gliwice market research",trustLevel:"TRUSTED",authority:90,sourceTimestamp:Date.now()});
  assert.equal(k.retrieve({retrievalId:"r",tenantId:"t1",actorId:"a",query:"Gliwice market",maxResults:10,maxContextChars:1000}).length,0);
  const t2=k.ingest({knowledgeId:"k3",tenantId:"t2",sourceId:"s3",sourceType:"INTERNAL",content:"Gliwice market research",trustLevel:"TRUSTED",authority:90,sourceTimestamp:Date.now()});
  k.activate(t2.knowledgeId,t2.version);
  assert.equal(k.retrieve({retrievalId:"r2",tenantId:"t2",actorId:"a",query:"Gliwice market",maxResults:10,maxContextChars:1000}).length,1);
});

test("M26 context is bounded and provenance preserving",()=>{
  const k=new KnowledgeContextFabric();
  const o=k.ingest({knowledgeId:"k1",tenantId:"t1",sourceId:"s1",sourceType:"INTERNAL",content:"alpha beta gamma",trustLevel:"TRUSTED",authority:100,sourceTimestamp:Date.now()});
  k.activate(o.knowledgeId,o.version);
  const c=k.buildContext({retrievalId:"r",tenantId:"t1",actorId:"a",query:"alpha",maxResults:10,maxContextChars:40});
  assert.ok(c.contextHash.length===64);
  assert.equal(c.references[0].provenance.sourceId,"s1");
});
