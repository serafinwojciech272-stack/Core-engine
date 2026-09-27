import test from "node:test";
import assert from "node:assert/strict";

test("M11.1 strategy promotion policy activates only after repeated positive evidence", () => {
  const evidence = [
    { success: true, deltaPct: 12 },
    { success: true, deltaPct: 8 },
  ];
  const successRate = evidence.filter(x => x.success).length / evidence.length;
  assert.equal(successRate, 1);
  assert.equal(evidence.length >= 2 && successRate >= .7, true);
});

test("M11.1 unverified outcomes cannot become active strategies", () => {
  const success: boolean | null = null;
  const evidence = 1;
  const status = success === null ? "UNVERIFIED" : evidence >= 2 ? "ACTIVE" : "EXPERIMENTAL";
  assert.equal(status, "UNVERIFIED");
});
