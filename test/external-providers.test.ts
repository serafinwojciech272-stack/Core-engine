import assert from "node:assert/strict";
import test from "node:test";
import { capabilityAdapterList, resolveCapabilityAdapter } from "../lib/capability-adapters";
import { providerReadiness } from "../lib/provider-adapters";
import { getCapabilityPack } from "../lib/capability-registry";
import "../lib/external-provider-pack";

test("external providers are registered without exposing secrets", () => {
  const ids = capabilityAdapterList().map((adapter) => adapter.id);
  assert.ok(ids.includes("provider.github.v1"));
  assert.ok(ids.includes("provider.vercel.v1"));
  assert.ok(ids.includes("provider.build-deploy.v1"));
  const readiness = providerReadiness();
  assert.equal(typeof readiness.github.configured, "boolean");
  assert.equal(typeof readiness.vercel.configured, "boolean");
});

test("provider actions resolve to specialised adapters", () => {
  const github = resolveCapabilityAdapter({
    id: "github.repository.create",
    name: "Create GitHub repository",
    description: "test",
    risk: "HIGH",
    requiresApproval: true,
    inputs: [],
    outputs: []
  });
  const deploy = resolveCapabilityAdapter({
    id: "vercel.project.deploy",
    name: "Deploy to Vercel",
    description: "test",
    risk: "CRITICAL",
    requiresApproval: true,
    inputs: [],
    outputs: []
  });
  const pipeline = resolveCapabilityAdapter({
    id: "project.build_and_deploy",
    name: "Build and deploy",
    description: "test",
    risk: "CRITICAL",
    requiresApproval: true,
    inputs: [],
    outputs: []
  });
  assert.equal(github?.id, "provider.github.v1");
  assert.equal(deploy?.id, "provider.vercel.v1");
  assert.equal(pipeline?.id, "provider.build-deploy.v1");
});

test("external provider capability pack enforces approval", () => {
  const pack = getCapabilityPack("core.external-providers.v1");
  assert.ok(pack);
  for (const action of pack!.actions) assert.equal(action.requiresApproval, true);
});
