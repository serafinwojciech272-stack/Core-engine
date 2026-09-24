import test from "node:test";
import assert from "node:assert/strict";
import { ensureCapabilityPacks } from "../lib/capability-packs";
import { listCapabilityPacks, findCapabilities } from "../lib/capability-registry";

test("WordPress-inspired capability catalog covers core website powers", () => {
  ensureCapabilityPacks();
  const packs = listCapabilityPacks();
  assert.ok(packs.length >= 15);
  for (const required of ["seo-suite","visual-builder","commerce-suite","forms-leads","analytics-suite","security-suite","performance-suite","backup-recovery","redirect-manager","email-delivery","spam-protection","custom-data","social-growth","localization","monitoring-observability"]) {
    assert.ok(packs.some((pack) => pack.id === required), required);
  }
});

test("high impact capability actions require approval", () => {
  ensureCapabilityPacks();
  const packs = listCapabilityPacks();
  for (const pack of packs) {
    for (const action of pack.actions) {
      if (action.risk === "HIGH" || action.risk === "CRITICAL") assert.equal(action.requiresApproval, true);
    }
  }
});

test("capability search is usable by the AI control plane", () => {
  ensureCapabilityPacks();
  assert.ok(findCapabilities("SEO").some((pack) => pack.id === "seo-suite"));
  assert.ok(findCapabilities("checkout").some((pack) => pack.id === "commerce-suite"));
  assert.ok(findCapabilities("security").some((pack) => pack.id === "security-suite"));
});
