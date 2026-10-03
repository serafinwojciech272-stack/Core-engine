import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("M12.2 migration persists execution authorization and enforces approval", () => {
  const sql = readFileSync("supabase/migrations/20261003002000_m12_2_execution_authorization_ledger.sql", "utf8");
  assert.match(sql, /ce_agent_execution_authorizations/);
  assert.match(sql, /a\.status <> 'APPROVED' or c\.status <> 'APPROVED'/);
  assert.match(sql, /MISSION_STATE_NOT_EXECUTABLE/);
  assert.match(sql, /CAPABILITY_SCOPE_MISMATCH/);
  assert.match(sql, /CORRELATION_MISMATCH/);
  assert.match(sql, /STATE_CHANGED/);
  assert.match(sql, /APPROVED','EXECUTING','system'/);
});

test("M12.2 authorization is consumed exactly once", () => {
  const sql = readFileSync("supabase/migrations/20261003002000_m12_2_execution_authorization_ledger.sql", "utf8");
  assert.match(sql, /status='AUTHORIZED'/);
  assert.match(sql, /status='CONSUMED'/);
  assert.match(sql, /EXECUTION_AUTHORIZATION_NOT_ACTIVE/);
});

test("M12.2 API never grants local composition approval as execution permission", () => {
  const route = readFileSync("app/api/agent/control/route.ts", "utf8");
  assert.match(route, /executionPermission: false/);
  assert.match(route, /PERSISTENT_APPROVAL_AUTHORIZATION_REQUIRED/);
  assert.match(route, /enforcePersistentAgentExecution/);
});
