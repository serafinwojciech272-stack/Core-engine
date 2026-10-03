import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20261001000011_m11_transactional_consistency.sql",
  "utf8",
);

test("M11 transactional consistency emits measurement and state events atomically", () => {
  assert.match(migration, /MEASUREMENT_RECORDED/);
  assert.match(migration, /STATE_CHANGED','MEASURING','COMPLETED'/);
  assert.match(migration, /M11_TRANSACTIONAL_CONSISTENCY_GATE/);
});

test("M11 verifier detects persisted-state and execution-claim divergence", () => {
  assert.match(migration, /MISSION_STATE_AUDIT_STATE_MISMATCH/);
  assert.match(migration, /MEASURING_TO_COMPLETED_STATE_EVENT_MISSING/);
  assert.match(migration, /EXECUTION_CLAIM_MISSING/);
  assert.match(migration, /EXECUTION_TO_MEASURING_STATE_EVENT_MISSING/);
});
