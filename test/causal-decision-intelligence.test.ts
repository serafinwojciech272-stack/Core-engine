import test from "node:test";
import assert from "node:assert/strict";
import { assessCausalDecision } from "@/lib/causal-decision-intelligence";

test("M10.4 preserves strong clean decisions", () => {
  const r = assessCausalDecision({
    confidence:.86, priority:"HIGH", evidenceCount:4, recommendation:"Run controlled experiment"
  });
  assert.equal(r.decision,"PROCEED");
  assert.equal(r.risk,"LOW");
  assert.equal(r.adjustedConfidence,.86);
});

test("M10.4 downgrades contradictory context", () => {
  const r = assessCausalDecision({
    confidence:.82, priority:"HIGH", evidenceCount:3, recommendation:"Act",
    contradictions:[{status:"OPEN",conflict_type:"VALUE_MISMATCH"}]
  });
  assert.equal(r.decision,"MEASURE_FIRST");
  assert.ok(r.adjustedConfidence < .82);
  assert.ok(r.warnings.some(x => x.includes("contradiction")));
});

test("M10.4 blocks critical unknowns", () => {
  const r = assessCausalDecision({
    confidence:.9, priority:"HIGH", evidenceCount:5, recommendation:"Act",
    unknowns:[{status:"OPEN",importance:"CRITICAL"}]
  });
  assert.equal(r.decision,"BLOCK");
  assert.ok(r.blockers.includes("CRITICAL_UNKNOWN"));
});

test("M10.4 never invents certainty from thin evidence", () => {
  const r = assessCausalDecision({
    confidence:.7, priority:"MEDIUM", evidenceCount:0, recommendation:"Act"
  });
  assert.equal(r.decision,"MEASURE_FIRST");
  assert.ok(r.adjustedConfidence < .7);
});
