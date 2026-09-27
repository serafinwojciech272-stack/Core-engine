import test from "node:test";
import assert from "node:assert/strict";
import { commercialRuntimeStatus, resolveTenant } from "@/lib/commercial-runtime";

test("M9.1 commercial runtime has one explicit tenant contract", () => {
  const previous = process.env.CORE_ENGINE_TENANT_ID;
  process.env.CORE_ENGINE_TENANT_ID = "tenant-test";
  const tenant = resolveTenant(new Request("https://core-engine.test", { headers: { authorization: "Bearer test" } }));
  assert.equal(tenant.tenantKey, "tenant-test");
  assert.match(tenant.tenantId, /^[0-9a-f-]{36}$/);
  if (previous === undefined) delete process.env.CORE_ENGINE_TENANT_ID;
  else process.env.CORE_ENGINE_TENANT_ID = previous;
});

test("M9.1 exposes durable usage and tenant isolation contract", () => {
  const status = commercialRuntimeStatus();
  assert.equal(status.contract, "commercial-runtime-v1");
  assert.equal(status.tenantIsolation, "application-scoped");
  assert.equal(status.usageMetering, "durable");
  assert.equal(status.failClosedInProduction, true);
});
