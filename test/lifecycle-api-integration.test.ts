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

test("real HTTP API blocks completion when KPI outcome is unverifiable", async () => {
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

  const result = await api("/api/mission", {
    id: missionId,
    action: "complete",
    idempotencyKey: `unverified-${missionId}-complete`,
    outcome: { before: 10, direction: "higher" }
  });

  assert.equal(result.response.status, 422);
  assert.equal(result.json.ok, false);
  assert.equal(result.json.error, "OUTCOME_UNVERIFIED");
  assert.equal(result.json.assessment?.quality, "UNVERIFIED");
});
