import { createHmac } from "node:crypto";
import { understand, decide, learn } from "@/lib/cognition/synthesis";
import type { CapabilityAction, CapabilityFailureCategory } from "@/lib/capability-contracts";
import { providerAdapters } from "@/lib/provider-adapters";

export type CapabilityAdapterContext = { missionId?: string; idempotencyKey?: string; attempt: number; input?: Record<string, unknown> };
export type CapabilityAdapterReceipt = { status: "EXECUTED" | "REJECTED" | "FAILED"; startedAt: string; completedAt: string; sideEffect: boolean; message: string; output?: Record<string, unknown>; errorCategory?: CapabilityFailureCategory; retryable?: boolean };
export type CapabilityAdapter = { id: string; observationalOnly?: boolean; supports: (action: CapabilityAction) => boolean; execute: (action: CapabilityAction, context: CapabilityAdapterContext) => Promise<CapabilityAdapterReceipt> };

const simulationAdapter: CapabilityAdapter = {
  id: "core.simulation.v1", observationalOnly: true, supports: () => true,
  async execute(action) {
    const startedAt = new Date().toISOString();
    return { status: "EXECUTED", startedAt, completedAt: new Date().toISOString(), sideEffect: false, message: `Adapter accepted ${action.id}. External side effects remain disabled until a product integration adapter is explicitly registered.`, output: { adapterId: "core.simulation.v1", actionId: action.id } };
  }
};

function safePublicHttpUrl(value: unknown): URL {
  if (typeof value !== "string") throw new Error("URL_REQUIRED");
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("UNSUPPORTED_URL_PROTOCOL");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host === "::1" || host.endsWith(".localhost")) throw new Error("PRIVATE_URL_BLOCKED");
  if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) throw new Error("PRIVATE_URL_BLOCKED");
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) throw new Error("PRIVATE_URL_BLOCKED");
  return url;
}

function webhookAllowed(url: URL) {
  const raw = process.env.CORE_ENGINE_WEBHOOK_ALLOWLIST?.trim();
  if (!raw) throw new Error("WEBHOOK_ALLOWLIST_NOT_CONFIGURED");
  const allowed = raw.split(",").map((item) => item.trim()).filter(Boolean);
  return allowed.some((entry) => {
    try {
      const base = new URL(entry);
      return base.protocol === url.protocol && base.host === url.host && url.pathname.startsWith(base.pathname.endsWith("/") ? base.pathname : base.pathname + "/");
    } catch { return false; }
  });
}

const publicWebAuditAdapter: CapabilityAdapter = {
  id: "core.web-audit.v1", observationalOnly: true, supports: (action) => action.id === "seo.audit",
  async execute(action, context) {
    const startedAt = new Date().toISOString();
    const url = safePublicHttpUrl(context.input?.url);
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url.toString(), { method: "GET", redirect: "error", signal: controller.signal, headers: { "user-agent": "Core-Engine-Agent/1.0" } });
      const html = (await response.text()).slice(0, 1000000);
      const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || null;
      const description = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1]?.trim() || null;
      return { status: "EXECUTED", startedAt, completedAt: new Date().toISOString(), sideEffect: false, message: `Live web audit completed for ${url.origin}`, output: { adapterId: "core.web-audit.v1", actionId: action.id, url: url.toString(), httpStatus: response.status, contentType: response.headers.get("content-type"), title, descriptionPresent: Boolean(description), canonicalPresent: /<link[^>]+rel=["']canonical["']/i.test(html), viewportPresent: /<meta[^>]+name=["']viewport["']/i.test(html), bytesSampled: html.length } };
    } finally { clearTimeout(timer); }
  }
};

const webhookAdapter: CapabilityAdapter = {
  id: "core.webhook.v1", supports: (action) => action.id === "integration.webhook.dispatch",
  async execute(action, context) {
    const startedAt = new Date().toISOString();
    if (!context.idempotencyKey?.trim()) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
    const input = context.input ?? {};
    const url = safePublicHttpUrl(input.url);
    if (!webhookAllowed(url)) throw new Error("WEBHOOK_TARGET_NOT_ALLOWLISTED");
    const method = typeof input.method === "string" ? input.method.toUpperCase() : "POST";
    if (!["POST", "PUT", "PATCH"].includes(method)) throw new Error("WEBHOOK_METHOD_NOT_ALLOWED");
    const payload = input.payload === undefined ? {} : input.payload;
    const body = JSON.stringify({ event: "core_engine.capability", actionId: action.id, missionId: context.missionId ?? null, idempotencyKey: context.idempotencyKey, payload });
    const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "Core-Engine-Agent/1.0", "x-core-engine-idempotency-key": context.idempotencyKey };
    const secret = process.env.CORE_ENGINE_WEBHOOK_SECRET?.trim();
    if (secret) headers["x-core-engine-signature"] = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url.toString(), { method, headers, body, redirect: "error", signal: controller.signal, cache: "no-store" });
      const responseText = (await response.text()).slice(0, 4096);
      if (!response.ok) throw new Error(`WEBHOOK_HTTP_${response.status}`);
      return { status: "EXECUTED", startedAt, completedAt: new Date().toISOString(), sideEffect: true, message: `Webhook dispatched to ${url.origin}`, output: { adapterId: "core.webhook.v1", actionId: action.id, requestId: context.idempotencyKey, httpStatus: response.status, responseSample: responseText } };
    } finally { clearTimeout(timer); }
  }
};

const cognitionAdapter: CapabilityAdapter = {
  id: "core.cognition.llm.v1",
  observationalOnly: true,
  supports: (action) => action.id === "cognition.llm.synthesize",
  async execute(action, context) {
    const startedAt = new Date().toISOString();
    const input = context.input ?? {};
    const operation = typeof input.operation === "string" ? input.operation : "";
    const tenantId = typeof input.tenant_id === "string" ? input.tenant_id : "";
    if (!tenantId) throw new Error("COGNITION_TENANT_REQUIRED");
    if (operation === "understand" && typeof input.text === "string") {
      const result = await understand({ tenantId, missionId: context.missionId, text: input.text });
      return { status: "EXECUTED", startedAt, completedAt: new Date().toISOString(), sideEffect: false, message: "Cognition understand synthesis completed.", output: { operation, result } };
    }
    if (operation === "decide" && input.deterministicDecision && typeof input.deterministicDecision === "object") {
      const result = await decide({ tenantId, missionId: context.missionId, context: typeof input.context === "string" ? input.context : JSON.stringify(input.context ?? ""), deterministicDecision: input.deterministicDecision as Parameters<typeof decide>[0]["deterministicDecision"] });
      return { status: "EXECUTED", startedAt, completedAt: new Date().toISOString(), sideEffect: false, message: "Cognition decision synthesis completed.", output: { operation, result } };
    }
    if (operation === "learn") {
      const result = await learn({ tenantId, missionId: context.missionId, outcome: input.outcome });
      return { status: "EXECUTED", startedAt, completedAt: new Date().toISOString(), sideEffect: false, message: "Cognition learning draft completed.", output: { operation, result } };
    }
    return { status: "REJECTED", startedAt, completedAt: new Date().toISOString(), sideEffect: false, message: "Unsupported cognition operation.", errorCategory: "EXECUTION_BLOCKED", retryable: false };
  }
};

const adapters: CapabilityAdapter[] = [...providerAdapters, publicWebAuditAdapter, webhookAdapter, cognitionAdapter, simulationAdapter];
export function isObservationalAdapter(adapter: CapabilityAdapter) { return adapter.observationalOnly === true || adapter.id === "core.simulation.v1"; }
export function registerCapabilityAdapter(adapter: CapabilityAdapter) { if (!adapter.id.trim()) throw new Error("CAPABILITY_ADAPTER_ID_REQUIRED"); if (adapters.some((item) => item.id === adapter.id)) throw new Error("CAPABILITY_ADAPTER_ALREADY_REGISTERED"); adapters.push(adapter); }
// Registry maintenance primitive. Removing the last adapter that supports an
// action is how an operator disables a capability (it then reports
// ADAPTER_NOT_FOUND) without touching the mission lifecycle.
export function unregisterCapabilityAdapter(id: string) { const index = adapters.findIndex((adapter) => adapter.id === id); if (index === -1) return false; adapters.splice(index, 1); return true; }
// The simulation adapter is an explicit last-resort fallback. Specialised
// adapters are consulted first so resolution stays deterministic regardless of
// registration order.
export function resolveCapabilityAdapter(action: CapabilityAction) {
  const specialised = adapters.find((adapter) => adapter.id !== "core.simulation.v1" && adapter.supports(action));
  if (specialised) return specialised;
  return adapters.find((adapter) => adapter.id === "core.simulation.v1" && adapter.supports(action)) ?? null;
}
export function listCapabilityAdapters() { return adapters.map(({ id }) => id); }
export function capabilityAdapterList() { return [...adapters]; }
export function describeCapabilityAdapters() { return adapters.map((adapter) => ({ id: adapter.id, observationalOnly: isObservationalAdapter(adapter) })); }
