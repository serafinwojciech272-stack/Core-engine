import { strict as assert } from "node:assert";
import { buildStrategyEvolutionProposal } from "../lib/strategy-evolution";

const insufficient = buildStrategyEvolutionProposal({
  strategyId:"s1", name:"A", problemPattern:"P", evidenceCount:1, successRate:.9, avgDeltaPct:10, confidence:.8, status:"EXPERIMENTAL"
});
assert.equal(insufficient.proposalType, "IMPROVEMENT");
assert.equal(insufficient.proposedChanges.minimumEvidence, 2);

const weak = buildStrategyEvolutionProposal({
  strategyId:"s1", name:"A", problemPattern:"P", evidenceCount:4, successRate:.6, avgDeltaPct:-2, confidence:.6, status:"ACTIVE"
});
assert.equal(weak.proposalType, "IMPROVEMENT");
assert.equal(weak.proposedChanges.require_new_experiment, true);

const strong = buildStrategyEvolutionProposal({
  strategyId:"s1", name:"A", problemPattern:"P", evidenceCount:5, successRate:.9, avgDeltaPct:12, confidence:.9, status:"ACTIVE"
});
assert.equal(strong.proposalType, "SPECIALIZATION");
assert.equal(strong.proposedChanges.preserve_parent, true);

const deprecated = buildStrategyEvolutionProposal({
  strategyId:"s1", name:"A", problemPattern:"P", evidenceCount:9, successRate:.9, avgDeltaPct:12, confidence:.9, status:"DEPRECATED"
});
assert.equal(deprecated.proposalType, "DEPRECATION");
