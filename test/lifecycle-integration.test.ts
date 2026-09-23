import test from "node:test";
import assert from "node:assert/strict";
import { buildDecision } from "../lib/ai-decision.ts";
import { buildAuditChain, verifyAuditChain } from "../lib/audit-chain.ts";
import { buildLearningLesson } from "../lib/learning-engine.ts";
import { assessOutcome } from "../lib/outcome-quality.ts";
import { evaluateMissionAction } from "../lib/policy.ts";
import { transitionMission, type Mission } from "../lib/engine.ts";
import type { Context, Evidence } from "../lib/core-contracts.ts";

test("full core lifecycle integrates signal through learning and audit", async () => {
  const signals = [
    { name: "qualified_leads", value: "84", source: "crm" },
    { name: "response_latency_minutes", value: "47", source: "crm" },
    { name: "conversion_rate", value: "2.8%", source: "analytics" }
  ];

  // Signal -> Context -> Evidence
  const context: Context = {
    domain: "business",
    subjectId: "demo-account",
    objective: "Increase qualified lead conversion",
    constraints: ["no uncontrolled execution"],
    signals
  };

  const evidence: Evidence[] = signals.map((s, index) => ({
    id: `e${index + 1}`,
    claim: `${s.name} = ${s.value}`,
    source: s.source,
    reliability: 0.9,
    supports: true
  }));

  assert.equal(context.signals.length, 3);
  assert.equal(evidence.length, 3);

  // Diagnosis -> Decision
  const decision = await buildDecision(signals, "business", []);
  assert.ok(decision.id);
  assert.ok(decision.diagnosis.length > 0);
  assert.ok(decision.recommendation.length > 0);
  assert.ok(decision.evidence.length >= 3);
  assert.ok(decision.confidence >= 0 && decision.confidence <= 1);

  // Policy -> Mission
  const mission: Mission = {
    id: crypto.randomUUID(),
    decisionId: decision.id,
    domain: context.domain,
    objective: context.objective!,
    state: "AWAITING_APPROVAL",
    kpi: "lead_to_opportunity_rate",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    executionCount: 0
  };

  assert.deepEqual(
    evaluateMissionAction("approve", mission.state),
    { allowed: true, actor: "human", reason: "POLICY_ALLOWED" }
  );

  // Approval -> Execute -> Measure -> Complete -> Learn
  const approved = transitionMission(mission, "APPROVED");
  assert.equal(approved.state, "APPROVED");
  assert.equal(evaluateMissionAction("execute", approved.state).allowed, true);

  const executing = transitionMission(approved, "EXECUTING");
  executing.executionCount += 1;
  assert.equal(executing.state, "EXECUTING");

  const outcome = { before: 2.8, after: 3.36, direction: "higher" };
  const assessment = assessOutcome(outcome);
  assert.equal(assessment.quality, "VERIFIED");
  assert.equal(assessment.improved, true);
  assert.equal(evaluateMissionAction("measure", executing.state).allowed, true);

  const measuring = transitionMission(executing, "MEASURING");
  const completed = transitionMission(measuring, "COMPLETED");
  assert.equal(completed.state, "COMPLETED");
  assert.equal(evaluateMissionAction("learn", completed.state).allowed, true);

  const lesson = buildLearningLesson(assessment, {
    missionObjective: completed.objective,
    kpi: completed.kpi
  });
  assert.equal(lesson.quality, "VERIFIED");
  assert.equal(lesson.lessonType, "POSITIVE_DELTA");
  assert.ok(lesson.lesson.includes(completed.kpi));

  const learned = transitionMission(completed, "LEARNED");
  assert.equal(learned.state, "LEARNED");

  // Audit is the final integrity boundary for the lifecycle.
  const trace = [
    "OBSERVE",
    "DIAGNOSE",
    "PRIORITIZE",
    "DECIDE",
    "POLICY",
    "MISSION",
    "APPROVAL",
    "EXECUTE",
    "MEASURE",
    "COMPLETE",
    "LEARN"
  ];

  const audit = await buildAuditChain({
    signals,
    decision,
    mission: learned,
    trace
  });

  assert.equal(audit.length, 4);
  const verification = await verifyAuditChain(audit);
  assert.equal(verification.valid, true);
  assert.equal(verification.checked, 4);
  assert.notEqual(audit[0].hash, audit[1].hash);
});

test("lifecycle rejects completion when KPI cannot be verified", () => {
  const assessment = assessOutcome({
    before: 10,
    direction: "higher"
  });

  assert.equal(assessment.quality, "UNVERIFIED");

  const mission: Mission = {
    id: crypto.randomUUID(),
    decisionId: "d-unverified",
    domain: "business",
    objective: "Verify KPI outcome",
    state: "MEASURING",
    kpi: "conversion_rate",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    executionCount: 1
  };

  assert.equal(evaluateMissionAction("complete", mission.state).allowed, true);
  assert.equal(assessment.quality, "UNVERIFIED");
  assert.throws(() => {
    if (assessment.quality === "UNVERIFIED") throw new Error("OUTCOME_UNVERIFIED");
  }, /OUTCOME_UNVERIFIED/);
});
