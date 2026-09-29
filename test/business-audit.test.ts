import test from "node:test";
import assert from "node:assert/strict";
import {runBusinessAudit} from "@/lib/business-audit";

test("business audit converts public web evidence into a trust gate and opportunities",async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response('<html><head><title>Example Business</title><meta name="description" content="Sell more"><meta name="viewport" content="width=device-width"><link rel="canonical" href="https://example.com/"></head><body>ok</body></html>',{status:200,headers:{"content-type":"text/html"}});
  try{
    const result=await runBusinessAudit({url:"https://example.com",idempotencyKey:"audit-test-1",missionId:"business-audit:test"});
    assert.equal(result.trustGate,"PASS");
    assert.equal(result.httpStatus,200);
    assert.equal(result.signals.length,5);
    assert.ok(result.opportunities.length>=1);
  }finally{globalThis.fetch=originalFetch}
});

test("business audit blocks private targets before network access",async()=>{
  await assert.rejects(()=>runBusinessAudit({url:"http://127.0.0.1:8080",idempotencyKey:"audit-test-private",missionId:"business-audit:test"}),/PRIVATE_URL_BLOCKED/);
});
