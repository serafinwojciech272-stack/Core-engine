import test from "node:test";
import assert from "node:assert/strict";
import { ResourceControlPlane } from "@/lib/resource-control-plane";

test("M24 hard budget blocks and reservation is atomic/idempotent",()=>{
  const p=new ResourceControlPlane();
  p.upsertBudget({budgetId:"b1",tenantId:"t1",scopeType:"MISSION",scopeId:"m1",resourceType:"TOKENS",amount:100,softLimit:80,hardLimit:100,startsAt:0,endsAt:Date.now()+60000,version:1});
  const a=p.reserve("b1",70,"x");
  assert.equal(a.allowed,true);
  const b=p.reserve("b1",40,"y");
  assert.equal(b.allowed,false);
  assert.ok(b.reasonCodes.includes("BUDGET_EXCEEDED"));
  const again=p.reserve("b1",70,"x");
  assert.equal(again.reservationId,a.reservationId);
  assert.equal(p.available("b1"),30);
});

test("M24 consumed reservation becomes usage budget",()=>{
  const p=new ResourceControlPlane();
  p.upsertBudget({budgetId:"b1",tenantId:"t1",scopeType:"TENANT",scopeId:"t1",resourceType:"API_REQUESTS",amount:10,softLimit:8,hardLimit:10,startsAt:0,endsAt:Date.now()+60000,version:1});
  const r=p.reserve("b1",3,"a");
  assert.ok(r.reservationId);
  p.consumeReservation(r.reservationId!);
  assert.equal(p.available("b1"),7);
  const u=p.recordUsage({tenantId:"t1",resourceType:"API_REQUESTS",quantity:3,unit:"request",idempotencyKey:"usage-a"});
  assert.equal(p.recordUsage({...u, idempotencyKey:"usage-a"} as never).usageId,u.usageId);
});
