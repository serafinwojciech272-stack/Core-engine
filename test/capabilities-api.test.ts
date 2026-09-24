import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/capabilities/route";

test("capability discovery API exposes the universal plugin-equivalent catalog", async () => {
  const response = await GET(new Request("http://localhost/api/capabilities?q=seo"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.ok(body.packs.some((pack: { id: string }) => pack.id === "seo-suite"));
});
