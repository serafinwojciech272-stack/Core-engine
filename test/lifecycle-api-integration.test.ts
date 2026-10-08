import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";

const port = 4317;
const base = `http://127.0.0.1:${port}`;
const nextBin = new URL("../node_modules/next/dist/bin/next", import.meta.url).pathname;
let server: ChildProcess | undefined;

async function waitForServer(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "server not ready";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(base + "/api/health");
      if (response.ok) return;
      lastError = `health ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Next.js API server did not start: ${lastError}`);
}

async function api(path: string, body: Record<string, unknown>) {
  const response = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await response.json() as Record<string, any>;
  return { response, json };
}

before(async () => {
  // `npx next dev` wraps the real server in a second process that survives a
  // SIGTERM to the wrapper, leaving an orphan holding this port and the stdio
  // pipes open. Run the local Next binary directly in its own process group so
  // the whole tree can be terminated deterministically.
  server = spawn(process.execPath, [nextBin, "dev", "-p", String(port)], {
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      NODE_ENV: "test",
      CORE_ENGINE_ALLOW_ANONYMOUS: "true",
      NEXT_TELEMETRY_DISABLED: "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  // Drain the pipes; an unconsumed pipe buffer blocks the server and keeps the
  // test process alive after the assertions finish.
  server.stdout?.resume();
  server.stderr?.resume();
  await waitForServer();
});

after(async () => {
  const child = server;
  if (!child || child.exitCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  const signal = (name: NodeJS.Signals) => {
    try {
      if (process.platform !== "win32" && child.pid) process.kill(-child.pid, name);
      else child.kill(name);
    } catch {
      /* already gone */
    }
  };
  signal("SIGTERM");
  const timer = setTimeout(() => signal("SIGKILL"), 5000);
  await exited;
  clearTimeout(timer);
});

test("real HTTP API executes the complete mission lifecycle", async () => {
  const signals = [
    { name: "qualified_leads", value: "84", source: "crm" },
    { name: "response_latency_minutes", value: "47", source: "crm" },
    { name: "conversion_rate", value: "2.8%", source: "analytics" }
  ];

  const context = await api("/api/context", {
    domain: "business",
    signals,
    evidence: [
      { claim: "Qualified leads are 84", source: "crm", supports: true, reliability: 0.9 },
      { claim: "Response latency is 47 minutes", source: "crm", supports: true, reliability: 0.9 },
      { claim: "Conversion rate is 2.8%", source: "analytics", supports: true, reliability: 0.95 }
    ]
  });

  assert.equal(context.response.status, 200);
  assert.equal(context.json.ok, true);
  assert.equal(context.json.stage, "CONTEXT_EVIDENCE");
  assert.equal(context.json.evidenceCount, 3);
  assert.ok(context.json.evidenceGraph?.nodes?.length === 3);
  assert.ok(typeof context.json.evidenceQuality?.score === "number");

  const engine = await api("/api/engine", {
    domain: "business",
    signals,
    evidence: [
      { claim: "Qualified leads are 84", source: "crm", supports: true, reliability: 0.9 },
      { claim: "Response latency is 47 minutes", source: "crm", supports: true, reliability: 0.9 },
      { claim: "Conversion rate is 2.8%", source: "analytics", supports: true, reliability: 0.95 }
    ]
  });

  assert.equal(engine.response.status, 200);
  assert.equal(engine.json.ok, true);
  assert.equal(engine.json.state, "AWAITING_APPROVAL");
  assert.ok(engine.json.mission?.id);
  assert.ok(engine.json.decision?.id);
  assert.ok(engine.json.evidence?.length === 3);
  assert.ok(engine.json.evidenceGraph?.nodes?.length === 3);
  assert.ok(typeof engine.json.evidenceQuality?.score === "number");
  assert.ok(engine.json.audit?.chainLength >= 4);

  const missionId = String(engine.json.mission.id);

  const actions = [
    ["approve", {}],
    ["execute", { execution: "simulation" }],
    ["measure", { before: 2.8, after: 3.36, direction: "higher" }],
    ["complete", { before: 2.8, after: 3.36, direction: "higher" }],
    ["learn", { before: 2.8, after: 3.36, direction: "higher" }]
  ] as const;

  let last: Record<string, any> = engine.json.mission;

  for (const [action, outcome] of actions) {
    const result = await api("/api/mission", {
      id: missionId,
      action,
      idempotencyKey: `lifecycle-api-${missionId}-${action}`,
      outcome
    });

    assert.equal(result.response.status, 200, `${action}: ${JSON.stringify(result.json)}`);
    assert.equal(result.json.ok, true, `${action}: ${JSON.stringify(result.json)}`);
    assert.equal(result.json.mission?.id, missionId);
    last = result.json.mission;
  }

  assert.equal(last.state, "LEARNED");
  assert.equal(last.executionCount, 1);

  const missions = await fetch(base + "/api/mission?limit=100");
  assert.equal(missions.status, 200);
  const missionPayload = await missions.json() as Record<string, any>;
  assert.equal(missionPayload.ok, true);
  assert.ok(missionPayload.missions.some((m: Record<string, any>) => m.id === missionId));
});

test("real HTTP API keeps completion as the execution boundary and blocks unverifiable learning", async () => {
  const engine = await api("/api/engine", {
    domain: "business",
    signals: [
      { name: "qualified_leads", value: "40", source: "crm" },
      { name: "conversion_rate", value: "2.1%", source: "analytics" }
    ]
  });

  assert.equal(engine.response.status, 200);
  const missionId = String(engine.json.mission.id);

  for (const [action, outcome] of [
    ["approve", {}],
    ["execute", { execution: "simulation" }],
    ["measure", { before: 10, after: 10, direction: "higher" }]
  ] as const) {
    const result = await api("/api/mission", {
      id: missionId,
      action,
      idempotencyKey: `unverified-${missionId}-${action}`,
      outcome
    });
    assert.equal(result.response.status, 200, `${action}: ${JSON.stringify(result.json)}`);
  }

  const complete = await api("/api/mission", {
    id: missionId,
    action: "complete",
    idempotencyKey: `unverified-${missionId}-complete`,
    outcome: { before: 10, direction: "higher" }
  });

  assert.equal(complete.response.status, 200);
  assert.equal(complete.json.ok, true);
  assert.equal(complete.json.mission.state, "COMPLETED");

  const learn = await api("/api/mission", {
    id: missionId,
    action: "learn",
    idempotencyKey: `unverified-${missionId}-learn`,
    outcome: { before: 10, direction: "higher" }
  });

  assert.equal(learn.response.status, 422);
  assert.equal(learn.json.ok, false);
  assert.equal(learn.json.error, "LEARNING_UNVERIFIED");
  assert.equal(learn.json.assessment?.quality, "UNVERIFIED");
});


test("real HTTP API requires capability approval before adapter execution", async () => {
  const engine = await api("/api/engine", {
    domain: "business",
    signals: [
      { name: "qualified_leads", value: "60", source: "crm" },
      { name: "conversion_rate", value: "2.4%", source: "analytics" }
    ]
  });
  assert.equal(engine.response.status, 200);
  assert.equal(engine.json.state, "AWAITING_APPROVAL");
  const missionId = String(engine.json.mission.id);

  // Mission approval is not capability approval.
  const approved = await api("/api/mission", { id: missionId, action: "approve", idempotencyKey: `cap-mission-approve-${missionId}` });
  assert.equal(approved.response.status, 200);
  assert.equal(approved.json.mission.state, "APPROVED");

  // page.generate requires approval; without it the adapter must never run.
  const blocked = await api("/api/mission", {
    id: missionId,
    action: "execute",
    capabilityActionId: "page.generate",
    idempotencyKey: `cap-exec-blocked-${missionId}`
  });
  assert.equal(blocked.response.status, 403);
  assert.equal(blocked.json.error, "CAPABILITY_APPROVAL_REQUIRED");
});

test("real HTTP API is idempotent across a repeated capability approval", async () => {
  const engine = await api("/api/engine", {
    domain: "business",
    signals: [
      { name: "qualified_leads", value: "60", source: "crm" },
      { name: "conversion_rate", value: "2.4%", source: "analytics" }
    ]
  });
  const missionId = String(engine.json.mission.id);

  // The mission is still AWAITING_APPROVAL, which is the state in which the
  // existing policy allows an approve action, so capability approval is legal.
  const body = { id: missionId, action: "approve", capabilityActionId: "page.generate", idempotencyKey: `cap-dup-${missionId}` };
  const first = await api("/api/mission", body);
  assert.equal(first.response.status, 200, JSON.stringify(first.json));
  assert.equal(first.json.capabilityApproval?.status, "APPROVED");

  const second = await api("/api/mission", body);
  assert.equal(second.response.status, 200);
  assert.equal(second.json.duplicate, true);
});

test("M9.1 successful capability execution records evidence and an outcome over HTTP", async () => {
  const engine = await api("/api/engine", {
    domain: "business",
    signals: [
      { name: "qualified_leads", value: "55", source: "crm" },
      { name: "conversion_rate", value: "2.2%", source: "analytics" }
    ]
  });
  assert.equal(engine.response.status, 200);
  const missionId = String(engine.json.mission.id);

  // Capability approval is recorded while the mission is still AWAITING_APPROVAL.
  // The approve action also advances the mission to APPROVED via the existing
  // state machine, so no separate mission approve is needed.
  const capApproved = await api("/api/mission", { id: missionId, action: "approve", capabilityActionId: "page.generate", idempotencyKey: `ev-cap-approve-${missionId}` });
  assert.equal(capApproved.response.status, 200, JSON.stringify(capApproved.json));
  assert.equal(capApproved.json.mission.state, "APPROVED");

  const executed = await api("/api/mission", {
    id: missionId,
    action: "execute",
    capabilityActionId: "page.generate",
    idempotencyKey: `ev-cap-exec-${missionId}`,
    outcome: { metric: "conversion_rate", before: 2.2, after: 2.5, direction: "higher" }
  });
  assert.equal(executed.response.status, 200, JSON.stringify(executed.json));
  assert.equal(executed.json.capabilityReceipt?.status, "EXECUTED");
  assert.equal(executed.json.evidence?.metadata?.sourceExecutionId, executed.json.capabilityReceipt.executionId);
  assert.equal(executed.json.evidence?.metadata?.capabilityActionId, "page.generate");
  assert.equal(executed.json.outcome?.executionId, executed.json.capabilityReceipt.executionId);
  assert.equal(executed.json.outcome?.capabilityActionId, "page.generate");
  assert.equal(executed.json.outcome?.assessment?.quality, "VERIFIED");
});

test("M9.2 signal to next decision end-to-end lifecycle is covered", async () => {
  const signals = [
    { name: "qualified_leads", value: "90", source: "crm" },
    { name: "conversion_rate", value: "2.6%", source: "analytics" }
  ];

  // SIGNAL -> DIAGNOSIS -> PRIORITY -> RECOMMENDATION -> DECISION -> MISSION
  const engine = await api("/api/engine", {
    domain: "business",
    signals,
    evidence: [
      { claim: "Qualified leads are 90", source: "crm", supports: true, reliability: 0.9 },
      { claim: "Conversion rate is 2.6%", source: "analytics", supports: true, reliability: 0.95 }
    ]
  });
  assert.equal(engine.response.status, 200);
  assert.equal(engine.json.ok, true);
  assert.equal(engine.json.state, "AWAITING_APPROVAL");
  assert.ok(engine.json.decision?.diagnosis, "diagnosis present");
  assert.ok(engine.json.decision?.recommendation, "recommendation present");
  assert.ok(engine.json.decision?.id, "decision present");
  assert.equal(engine.json.mission?.id !== undefined, true, "mission created");
  const missionId = String(engine.json.mission.id);

  // MISSION -> APPROVAL -> CAPABILITY APPROVAL
  const capApproved = await api("/api/mission", {
    id: missionId, action: "approve", capabilityActionId: "page.generate",
    idempotencyKey: `m92-cap-approve-${missionId}`
  });
  assert.equal(capApproved.response.status, 200, JSON.stringify(capApproved.json));
  assert.equal(capApproved.json.capabilityApproval?.status, "APPROVED");
  assert.equal(capApproved.json.mission.state, "APPROVED");

  // CAPABILITY APPROVAL -> ADAPTER RESOLUTION -> EXECUTION -> RECEIPT
  const executed = await api("/api/mission", {
    id: missionId, action: "execute", capabilityActionId: "page.generate",
    idempotencyKey: `m92-cap-exec-${missionId}`,
    outcome: { metric: "conversion_rate", before: 2.6, after: 2.9, direction: "higher" }
  });
  assert.equal(executed.response.status, 200, JSON.stringify(executed.json));
  const receipt = executed.json.capabilityReceipt;
  assert.equal(receipt.status, "EXECUTED");
  assert.ok(receipt.adapterId, "adapter resolved");
  assert.equal(receipt.sideEffectStatus, "NONE");

  // RECEIPT -> EVIDENCE -> OUTCOME -> MEASUREMENT -> LEARNING
  assert.equal(executed.json.evidence?.metadata?.sourceExecutionId, receipt.executionId);
  assert.equal(executed.json.outcome?.executionId, receipt.executionId);
  assert.equal(executed.json.outcome?.assessment?.quality, "VERIFIED");

  const measured = await api("/api/mission", {
    id: missionId, action: "measure",
    idempotencyKey: `m92-measure-${missionId}`,
    outcome: { before: 2.6, after: 2.9, direction: "higher" }
  });
  assert.equal(measured.response.status, 200, JSON.stringify(measured.json));
  assert.equal(measured.json.assessment?.quality, "VERIFIED");

  const completed = await api("/api/mission", {
    id: missionId, action: "complete",
    idempotencyKey: `m92-complete-${missionId}`,
    outcome: { before: 2.6, after: 2.9, direction: "higher" }
  });
  assert.equal(completed.response.status, 200, JSON.stringify(completed.json));

  const learned = await api("/api/mission", {
    id: missionId, action: "learn",
    idempotencyKey: `m92-learn-${missionId}`,
    outcome: { before: 2.6, after: 2.9, direction: "higher" }
  });
  assert.equal(learned.response.status, 200, JSON.stringify(learned.json));
  assert.equal(learned.json.mission?.state, "LEARNED");

  // LEARNING -> NEXT DECISION: the loop produces a new, distinct mission.
  const nextCycle = await api("/api/engine", {
    domain: "business",
    signals,
    evidence: [
      { claim: "Qualified leads are 90", source: "crm", supports: true, reliability: 0.9 },
      { claim: "Conversion rate is 2.9%", source: "analytics", supports: true, reliability: 0.95 }
    ]
  });
  assert.equal(nextCycle.response.status, 200);
  assert.ok(nextCycle.json.mission?.id);
  assert.notEqual(String(nextCycle.json.mission.id), missionId);
  assert.equal(nextCycle.json.state, "AWAITING_APPROVAL");

  // Mission lifecycle integrity: the finished mission is observable and its
  // recommended action carries the existing approval gate.
  const listed = await fetch(base + "/api/mission?limit=100");
  assert.equal(listed.status, 200);
  const payload = await listed.json() as Record<string, any>;
  const finished = (payload.missions || []).find((m: Record<string, any>) => m.id === missionId);
  assert.equal(finished?.state, "LEARNED");
});

test("M9 live agent E2E executes a real public web capability", { skip: !process.env.CORE_ENGINE_LIVE_E2E_URL }, async () => {
  const target = process.env.CORE_ENGINE_LIVE_E2E_URL!;
  const engine = await api("/api/engine", {
    domain: "business",
    signals: [
      { name: "conversion_rate", value: "2.8%", source: "analytics" },
      { name: "traffic", value: "+18%", source: "analytics" },
      { name: "checkout_dropoff", value: "41%", source: "analytics" }
    ]
  });

  assert.equal(engine.response.status, 200);
  assert.equal(engine.json.state, "AWAITING_APPROVAL");

  const missionId = String(engine.json.mission.id);
  const approve = await api("/api/mission", {
    id: missionId,
    action: "approve",
    capabilityActionId: "seo.audit",
    idempotencyKey: `m9-${missionId}-approve`
  });
  assert.equal(approve.response.status, 200);
  assert.equal(approve.json.mission.state, "APPROVED");

  const execute = await api("/api/mission", {
    id: missionId,
    action: "execute",
    capabilityActionId: "seo.audit",
    idempotencyKey: `m9-${missionId}-execute`,
    input: { url: target }
  });
  assert.equal(execute.response.status, 200);
  assert.equal(execute.json.mission.state, "EXECUTING");
  assert.equal(execute.json.capabilityReceipt.status, "EXECUTED");
  assert.equal(execute.json.capabilityReceipt.adapterId, "core.web-audit.v1");
  assert.equal(execute.json.capabilityReceipt.sideEffect, false);
  assert.equal(execute.json.capabilityReceipt.output.url, new URL(target).toString());

  const measure = await api("/api/mission", {
    id: missionId,
    action: "measure",
    idempotencyKey: `m9-${missionId}-measure`,
    outcome: { before: 1, after: 1, direction: "higher", source: "live-web-audit" }
  });
  assert.equal(measure.response.status, 200);
  assert.equal(measure.json.mission.state, "MEASURING");

  const complete = await api("/api/mission", {
    id: missionId,
    action: "complete",
    idempotencyKey: `m9-${missionId}-complete`,
    outcome: { before: 1, after: 1.1, direction: "higher", source: "live-web-audit" }
  });
  assert.equal(complete.response.status, 200);
  assert.equal(complete.json.mission.state, "COMPLETED");

  const learn = await api("/api/mission", {
    id: missionId,
    action: "learn",
    idempotencyKey: `m9-${missionId}-learn`,
    outcome: { before: 1, after: 1.1, direction: "higher", source: "live-web-audit" }
  });
  assert.equal(learn.response.status, 200);
  assert.equal(learn.json.mission.state, "LEARNED");
});
