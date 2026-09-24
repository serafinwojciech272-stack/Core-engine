import type {CapabilityAction} from "@/lib/capability-contracts";
import type {CapabilityAdapter, CapabilityAdapterContext, CapabilityAdapterReceipt} from "@/lib/capability-adapters";

const ACTION_ID = "external.webhook.dispatch";
const MAX_RESPONSE_BYTES = 8192;

function getWebhookConfig() {
  const url = process.env.CORE_ACTION_WEBHOOK_URL?.trim();
  const secret = process.env.CORE_ACTION_WEBHOOK_SECRET?.trim();
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("CORE_ACTION_WEBHOOK_URL_INVALID");
  }
  if (parsed.protocol !== "https:") throw new Error("CORE_ACTION_WEBHOOK_HTTPS_REQUIRED");
  return {url: parsed.toString(), secret};
}

async function executeWebhook(action: CapabilityAction, context: CapabilityAdapterContext): Promise<CapabilityAdapterReceipt> {
  const startedAt = new Date().toISOString();
  const config = getWebhookConfig();
  if (!config) {
    return {
      status: "REJECTED",
      startedAt,
      completedAt: new Date().toISOString(),
      sideEffect: false,
      message: "External webhook adapter is not configured."
    };
  }
  if (!context.idempotencyKey?.trim()) {
    return {
      status: "REJECTED",
      startedAt,
      completedAt: new Date().toISOString(),
      sideEffect: false,
      message: "An idempotency key is required for external action execution."
    };
  }

  const payload = JSON.stringify({
    contractVersion: "capability-webhook-v1",
    action: {
      id: action.id,
      name: action.name,
      description: action.description,
      risk: action.risk
    },
    missionId: context.missionId,
    idempotencyKey: context.idempotencyKey,
    input: context.input ?? {}
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "user-agent": "Core-Engine-Capability-Adapter/1.0",
      "x-core-engine-idempotency-key": context.idempotencyKey
    };
    if (context.missionId) headers["x-core-engine-mission-id"] = context.missionId;
    if (config.secret) headers["x-core-engine-signature"] = config.secret;

    const response = await fetch(config.url, {
      method: "POST",
      headers,
      body: payload,
      cache: "no-store",
      signal: controller.signal
    });
    const text = (await response.text()).slice(0, MAX_RESPONSE_BYTES);
    const completedAt = new Date().toISOString();
    if (!response.ok) {
      return {
        status: "FAILED",
        startedAt,
        completedAt,
        sideEffect: response.status < 500,
        message: `External webhook returned HTTP ${response.status}.`,
        output: {httpStatus: response.status, responseBody: text}
      };
    }
    return {
      status: "EXECUTED",
      startedAt,
      completedAt,
      sideEffect: true,
      message: "External webhook action executed successfully.",
      output: {httpStatus: response.status, responseBody: text}
    };
  } catch (error) {
    return {
      status: "FAILED",
      startedAt,
      completedAt: new Date().toISOString(),
      sideEffect: false,
      message: error instanceof Error ? error.message : "External webhook execution failed."
    };
  } finally {
    clearTimeout(timeout);
  }
}

export const externalWebhookAdapter: CapabilityAdapter = {
  id: "core.external-webhook.v1",
  supports: (action) => action.id === ACTION_ID,
  execute: executeWebhook
};
