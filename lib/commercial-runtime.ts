import { createHash, timingSafeEqual } from "node:crypto";

export type TenantContext = {
  tenantId: string;
  tenantKey: string;
};

const LOCAL_TENANT_ID = "09e12da8-24a5-5bfa-b2b4-c8d1d04aa0af";

function stableUuid(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
}

function constantTimeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest(), hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function configuredApiKeyTenant(token: string): string | null {
  const raw = process.env.CORE_ENGINE_API_KEYS_JSON;
  if (!raw) return null;
  try {
    const map = JSON.parse(raw) as Record<string, unknown>;
    for (const [tenantKey, secret] of Object.entries(map)) {
      if (typeof secret === "string" && constantTimeEqual(secret, token)) return tenantKey;
    }
  } catch {
    throw new Error("API_KEY_MAPPING_INVALID");
  }
  return null;
}

export function resolveTenant(request: Request): TenantContext {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const mapped = token ? configuredApiKeyTenant(token) : null;
  const tenantKey = mapped || process.env.CORE_ENGINE_TENANT_ID || (process.env.NODE_ENV === "production" ? "" : "local-development");
  if (!tenantKey) throw new Error("TENANT_NOT_CONFIGURED");
  const tenantId = process.env.CORE_ENGINE_TENANT_UUID || (tenantKey === "local-development" ? LOCAL_TENANT_ID : stableUuid("core-engine:tenant:" + tenantKey));
  return { tenantId, tenantKey };
}

export function commercialRuntimeStatus() {
  const mappingConfigured = Boolean(process.env.CORE_ENGINE_API_KEYS_JSON);
  const singleTenantConfigured = Boolean(process.env.CORE_ENGINE_TENANT_ID || process.env.CORE_ENGINE_TENANT_UUID);
  return {
    contract: "commercial-runtime-v1",
    tenantIsolation: "application-scoped",
    authMapping: mappingConfigured ? "multi-tenant-api-key-map" : singleTenantConfigured ? "single-tenant-api-key" : "not-configured",
    usageMetering: "durable",
    failClosedInProduction: true
  } as const;
}
