import test from "node:test";
import assert from "node:assert/strict";
import { composeAgent } from "@/lib/skills/agent-composition";

test("M12 composes a known skill and capability deterministically", () => {
  const result = composeAgent({
    tenantId: "tenant-demo",
    domain: "web",
    capability: "site.audit",
    signals: [],
    mode: "OBSERVATIONAL",
  });

  assert.equal(result.version, "M12.0");
  assert.equal(result.skill.id, "web.fullstack-builder");
  assert.equal(result.capability, "site.audit");
  assert.equal(result.execution.allowed, true);
  assert.equal(result.approval.required, true);
  assert.equal(result.learningBoundary.eligible, false);
  assert.equal(result.plan.length, 9);
});

test("M12 fails closed for unknown capabilities", () => {
  assert.throws(
    () => composeAgent({
      tenantId: "tenant-demo",
      domain: "web",
      capability: "unknown.capability",
      signals: [],
    }),
    /NO_COMPATIBLE_CAPABILITY/,
  );
});

test("M12 kill switch blocks composition execution", () => {
  const result = composeAgent({
    tenantId: "tenant-demo",
    domain: "trading",
    capability: "trade.execute",
    signals: [],
    mode: "LIVE",
    approved: true,
    killSwitchActive: true,
  });

  assert.equal(result.execution.allowed, false);
  assert.equal(result.execution.stage, "POLICY");
  assert.deepEqual(result.execution.reasons, ["KILL_SWITCH_ACTIVE"]);
});

test("M12 live critical execution remains approval-bound", () => {
  const result = composeAgent({
    tenantId: "tenant-demo",
    domain: "trading",
    capability: "trade.execute",
    signals: [],
    mode: "LIVE",
    approved: false,
  });

  assert.equal(result.execution.allowed, false);
  assert.equal(result.execution.stage, "APPROVAL");
  assert.equal(result.execution.reasons[0], "EXPLICIT_APPROVAL_REQUIRED");
  assert.equal(result.approval.required, true);
});
