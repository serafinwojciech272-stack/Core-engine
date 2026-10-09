#!/usr/bin/env node
const baseUrl = (process.env.CORE_ENGINE_BASE_URL || "https://core-engine-34uu.onrender.com").replace(/\/$/, "");
const apiKey = process.env.CORE_ENGINE_API_KEY?.trim();
if (!apiKey) {
  console.error("E2E_BLOCKED: set CORE_ENGINE_API_KEY to run authenticated production E2E.");
  process.exit(2);
}
const idempotencyKey = "m25-e2e-" + crypto.randomUUID();
const headers = { authorization: "Bearer " + apiKey, "content-type": "application/json" };
async function call(path, init = {}) {
  const response = await fetch(baseUrl + path, { ...init, headers: { ...headers, ...(init.headers || {}) }, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}
function assert(condition, message) {
  if (!condition) throw new Error("E2E_ASSERTION_FAILED: " + message);
}
try {
  const created = await call("/api/production/tasks", {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: JSON.stringify({
      title: "M25 production E2E persistence",
      objective: "Verify authenticated task creation, evidence-gated completion, durable readback and idempotent retry.",
      acceptanceCriteria: [
        { id: "readback", description: "Task is durably readable after creation", required: true },
        { id: "evidence", description: "Completion requires linked evidence", required: true }
      ]
    })
  });
  assert([200, 201].includes(created.status) && created.body.ok, "create returned " + created.status);
  const taskId = created.body.task?.id;
  assert(typeof taskId === "string" && created.body.version === 1, "created task/version missing");
  const replay = await call("/api/production/tasks", {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: JSON.stringify({ title: "duplicate must not replace original", objective: "replay", acceptanceCriteria: [{ id: "x", description: "x", required: true }] })
  });
  assert(replay.body.ok && replay.body.replayed === true && replay.body.task.id === taskId, "idempotency replay did not return original task");
  let read = await call("/api/production/tasks?id=" + encodeURIComponent(taskId));
  assert(read.status === 200 && read.body.task.id === taskId, "durable readback failed");
  let transitioned = await call("/api/production/tasks", { method: "PATCH", body: JSON.stringify({ id: taskId, version: 1, transition: { to: "ACCEPTED", at: new Date().toISOString() } }) });
  assert(transitioned.status === 200 && transitioned.body.task.state === "ACCEPTED", "ACCEPTED transition failed");
  transitioned = await call("/api/production/tasks", { method: "PATCH", body: JSON.stringify({ id: taskId, version: 2, transition: { to: "RUNNING", at: new Date().toISOString() } }) });
  assert(transitioned.status === 200 && transitioned.body.task.state === "RUNNING", "RUNNING transition failed");
  transitioned = await call("/api/production/tasks", { method: "PATCH", body: JSON.stringify({ id: taskId, version: 3, transition: { to: "VERIFYING", at: new Date().toISOString() } }) });
  assert(transitioned.status === 200 && transitioned.body.task.state === "VERIFYING", "VERIFYING transition failed");
  const premature = await call("/api/production/tasks", { method: "PATCH", body: JSON.stringify({ id: taskId, version: 4, transition: { to: "SUCCEEDED", at: new Date().toISOString(), summary: "must reject" } }) });
  assert(premature.status === 400, "success without evidence should be rejected");
  const completed = await call("/api/production/tasks", {
    method: "PATCH",
    body: JSON.stringify({
      id: taskId, version: 4,
      transition: {
        to: "SUCCEEDED",
        at: new Date().toISOString(),
        summary: "Production API E2E verified durable readback and idempotent replay.",
        criterionResults: [
          { criterionId: "readback", status: "PASS", evidenceRefs: ["e2e-readback"] },
          { criterionId: "evidence", status: "PASS", evidenceRefs: ["e2e-evidence"] }
        ],
        evidence: [
          { id: "e2e-readback", kind: "API_RESPONSE", summary: "Authenticated GET returned the same persisted task id." },
          { id: "e2e-evidence", kind: "TEST", summary: "E2E verified evidence-gated state transition." }
        ]
      }
    })
  });
  assert(completed.status === 200 && completed.body.task.state === "SUCCEEDED" && completed.body.task.score === 100, "evidence-backed completion failed");
  read = await call("/api/production/tasks?id=" + encodeURIComponent(taskId));
  assert(read.status === 200 && read.body.task.state === "SUCCEEDED" && read.body.version === 5, "terminal state/version not durable after reload");
  const stale = await call("/api/production/tasks", { method: "PATCH", body: JSON.stringify({ id: taskId, version: 4, transition: { to: "RUNNING", at: new Date().toISOString() } }) });
  assert(stale.status === 409, "stale version should return 409");
  console.log(JSON.stringify({ ok: true, taskId, state: read.body.task.state, score: read.body.task.score, version: read.body.version, checks: ["create", "idempotency", "durable-readback", "state-machine", "evidence-gate", "terminal-readback", "optimistic-concurrency"] }, null, 2));
} catch (error) {
  console.error("E2E_FAILED:", error instanceof Error ? error.message : String(error));
  process.exit(1);
}
