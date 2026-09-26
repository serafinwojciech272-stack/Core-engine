import type {CapabilityAction} from "@/lib/capability-contracts";

export type CapabilityAdapterContext = {
  missionId?: string;
  idempotencyKey?: string;
  input?: Record<string, unknown>;
};

export type CapabilityAdapterReceipt = {
  status: "EXECUTED" | "REJECTED" | "FAILED";
  startedAt: string;
  completedAt: string;
  sideEffect: boolean;
  message: string;
  output?: Record<string, unknown>;
};

export type CapabilityAdapter = {
  id: string;
  supports: (action: CapabilityAction) => boolean;
  execute: (action: CapabilityAction, context: CapabilityAdapterContext) => Promise<CapabilityAdapterReceipt>;
};

const simulationAdapter: CapabilityAdapter = {
  id: "core.simulation.v1",
  supports: () => true,
  async execute(action) {
    const startedAt = new Date().toISOString();
    return {
      status: "EXECUTED",
      startedAt,
      completedAt: new Date().toISOString(),
      sideEffect: false,
      message: `Adapter accepted ${action.id}. External side effects remain disabled until a product integration adapter is explicitly registered.`,
      output: {adapterId: "core.simulation.v1", actionId: action.id}
    };
  }
};


function safePublicHttpUrl(value: unknown): URL {
  if (typeof value !== "string") throw new Error("URL_REQUIRED");
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("UNSUPPORTED_URL_PROTOCOL");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host === "::1" || host.endsWith(".localhost")) throw new Error("PRIVATE_URL_BLOCKED");
  if (/^(127\\.|10\\.|192\\.168\\.|169\\.254\\.)/.test(host)) throw new Error("PRIVATE_URL_BLOCKED");
  if (/^172\\.(1[6-9]|2[0-9]|3[0-1])\\./.test(host)) throw new Error("PRIVATE_URL_BLOCKED");
  return url;
}

const publicWebAuditAdapter: CapabilityAdapter = {
  id: "core.web-audit.v1",
  supports: (action) => action.id === "seo.audit",
  async execute(action, context) {
    const startedAt = new Date().toISOString();
    const url = safePublicHttpUrl(context.input?.url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "error",
        signal: controller.signal,
        headers: { "user-agent": "Core-Engine-Agent/1.0" }
      });
      const html = (await response.text()).slice(0, 1000000);
      const title = html.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i)?.[1]?.replace(/\\s+/g, " ").trim() || null;
      const description = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1]?.trim() || null;
      const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html);
      const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
      const completedAt = new Date().toISOString();
      return {
        status: "EXECUTED",
        startedAt,
        completedAt,
        sideEffect: false,
        message: `Live web audit completed for ${url.origin}`,
        output: {
          adapterId: "core.web-audit.v1",
          actionId: action.id,
          url: url.toString(),
          httpStatus: response.status,
          contentType: response.headers.get("content-type"),
          title,
          descriptionPresent: Boolean(description),
          canonicalPresent: hasCanonical,
          viewportPresent: hasViewport,
          bytesSampled: html.length
        }
      };
    } finally {
      clearTimeout(timer);
    }
  }
};

const adapters: CapabilityAdapter[] = [publicWebAuditAdapter, simulationAdapter];

export function registerCapabilityAdapter(adapter: CapabilityAdapter) {
  if (!adapter.id.trim()) throw new Error("CAPABILITY_ADAPTER_ID_REQUIRED");
  if (adapters.some((item) => item.id === adapter.id)) throw new Error("CAPABILITY_ADAPTER_ALREADY_REGISTERED");
  adapters.push(adapter);
}

export function resolveCapabilityAdapter(action: CapabilityAction) {
  return adapters.find((adapter) => adapter.supports(action)) ?? null;
}

export function listCapabilityAdapters() {
  return adapters.map(({id}) => id);
}
