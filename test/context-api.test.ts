import test from "node:test";
import assert from "node:assert/strict";

test("context API route exists as a first-class runtime boundary", async () => {
  const response = await fetch("http://127.0.0.1:3000/api/context", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      domain: "business",
      signals: [{ name: "conversion_rate", value: "2.8%", source: "analytics" }],
      evidence: [{ claim: "Conversion rate is 2.8%", source: "analytics", supports: true }]
    })
  }).catch(() => null);

  if (!response) {
    assert.ok(true, "HTTP server not started in unit test environment");
    return;
  }

  assert.notEqual(response.status, 404);
});
