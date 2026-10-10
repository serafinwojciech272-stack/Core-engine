// Static guard against regressions of audit finding P1: every API handler must authenticate,
// unless it is explicitly listed here as public with a reason.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const PUBLIC: Record<string, string> = {
  "agent GET": "agent manifest / runtime status, no tenant data",
  "agent-control GET": "static contract",
  "audit/verify GET": "endpoint status",
  "capabilities GET": "capability catalog",
  "capabilities/actions GET": "capability catalog",
  "engine GET": "engine manifest",
  "health GET": "liveness; detailed view requires HEALTH_DETAIL_TOKEN",
  "integrations GET": "integration contract (client names are not credentials)",
  "intelligence-evidence GET": "service status",
  "model-intelligence GET": "model registry readiness",
  "model-registry GET": "model registry",
  "production-verify GET": "own token: PRODUCTION_VERIFY_TOKEN",
  "fcc-erp/billing/approval POST": "own key: FCC_INTERNAL_API_KEY",
  "saas GET": "SaaS status; identity only for the caller's own session",
  "skills GET": "skill catalog",
  "v1/ai GET": "gateway contract",
  "tender-intelligence/zabrze GET": "public showcase of a public tender case",
};

const GUARDS = ["guardMutation(", "authorizeTenant(", "requireTenant(", "tenantFor(", "authenticate(", "clientAllowed("];

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? routeFiles(p) : name === "route.ts" ? [p] : [];
  });
}

test("every API handler is authenticated or explicitly public", () => {
  const root = join(process.cwd(), "app/api");
  const violations: string[] = [];
  for (const file of routeFiles(root)) {
    const route = relative(root, file).replace(/\\/g, "/").replace(/\/route\.ts$/, "");
    const src = readFileSync(file, "utf8");
    const handlers = [...src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g)];
    handlers.forEach((m, i) => {
      const body = src.slice(m.index!, handlers[i + 1]?.index ?? src.length);
      const key = `${route} ${m[1]}`;
      if (PUBLIC[key]) return;
      if (!GUARDS.some((g) => body.includes(g))) violations.push(key);
    });
  }
  assert.deepEqual(violations, [], "unauthenticated handlers: " + violations.join(", "));
});

test("no route trusts a client-supplied tenantId", () => {
  const root = join(process.cwd(), "app/api");
  const offenders = routeFiles(root).filter((f) => /body\??\.tenantId\s*(?:,|\)|as)/.test(readFileSync(f, "utf8")) && !readFileSync(f, "utf8").includes("body.tenantId = auth.tenantId"));
  assert.deepEqual(offenders.map((f) => relative(root, f)), []);
});

test("no hardcoded tenant UUID fallbacks in API routes", () => {
  const root = join(process.cwd(), "app/api");
  const offenders = routeFiles(root).filter((f) => /\|\|\s*"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"/.test(readFileSync(f, "utf8")));
  assert.deepEqual(offenders.map((f) => relative(root, f)), []);
});
