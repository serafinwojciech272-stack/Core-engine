import test from "node:test";
import assert from "node:assert/strict";
import { designExperiment, evaluateExperiment } from "../lib/experiment-engine";

test("M12.2 designs reversible experiments with guardrails",()=>{
  const x=designExperiment({problem:"conversion decline",hypothesis:"pricing matters",baselineMetric:"0.10",targetMetric:"0.12",intervention:"test one pricing variant"});
  assert.equal(x.guardrails.length,3);
  assert.equal(x.successCriteria.length,3);
});

test("M12.2 supports a sufficiently evidenced positive experiment",()=>{
  assert.equal(evaluateExperiment({baseline:100,observed:112,direction:"higher",minEffect:.05,confidence:.8}).result,"SUPPORTED");
});

test("M12.2 keeps weak evidence inconclusive",()=>{
  assert.equal(evaluateExperiment({baseline:100,observed:120,direction:"higher",minEffect:.05,confidence:.5}).result,"INCONCLUSIVE");
});
