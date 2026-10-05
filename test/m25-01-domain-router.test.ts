import assert from "node:assert/strict";
import test from "node:test";
import { routeCoreEngineDomain } from "../lib/m25-01-domain-router";

test("M25.01 routes a clear equity request", () => {
  const result = routeCoreEngineDomain("Zrób DCF i analizę wyceny spółki oraz EPS");

  assert.equal(result.status, "ROUTED");
  assert.equal(result.primaryDomain, "EQUITY");
  assert.deepEqual(result.domains, ["EQUITY"]);
  assert.ok(result.confidence >= 0.5);
});

test("M25.01 detects multi-domain macro and forecasting request", () => {
  const result = routeCoreEngineDomain(
    "Jaka jest prognoza EUR/USD po decyzji Fed i jakie są scenariusze dla stóp procentowych?",
  );

  assert.equal(result.status, "MULTI_DOMAIN");
  assert.equal(result.primaryDomain, "FX_MACRO");
  assert.ok(result.domains.includes("FX_MACRO"));
  assert.ok(result.domains.includes("FORECASTING"));
});

test("M25.01 routes sports betting using quantitative terminology", () => {
  const result = routeCoreEngineDomain(
    "Policz implied probability, EV+, Kelly i stake dla tych kursów bukmacherskich",
  );

  assert.equal(result.status, "ROUTED");
  assert.equal(result.primaryDomain, "SPORTS_BETTING");
});

test("M25.01 does not manufacture a domain from an empty request", () => {
  const result = routeCoreEngineDomain("");

  assert.equal(result.status, "UNKNOWN");
  assert.equal(result.primaryDomain, null);
  assert.equal(result.confidence, 0);
  assert.deepEqual(result.unresolvedSignals, ["REQUEST_EMPTY"]);
});

test("M25.01 blocks weak single-signal routing", () => {
  const result = routeCoreEngineDomain("DCF");

  assert.equal(result.status, "AMBIGUOUS");
  assert.equal(result.primaryDomain, "EQUITY");
  assert.equal(result.confidence, 0.5);
  assert.ok(result.unresolvedSignals.includes("SINGLE_WEAK_DOMAIN_SIGNAL"));
});

test("M25.01 recognizes Polish real-estate language", () => {
  const result = routeCoreEngineDomain(
    "Oceń mieszkanie na wynajem: NOI, vacancy, cap rate i cash-on-cash",
  );

  assert.equal(result.primaryDomain, "REAL_ESTATE");
  assert.ok(result.domains.includes("REAL_ESTATE"));
});
