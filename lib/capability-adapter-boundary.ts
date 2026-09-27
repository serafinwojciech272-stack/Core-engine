import type { CapabilityAction } from "@/lib/capability-contracts";
import { isObservationalAdapter, resolveCapabilityAdapter, type CapabilityAdapter } from "@/lib/capability-adapters";

// M9 adapter boundary. This is a contract/policy layer over the existing adapter
// registry: it does not execute adapters itself and it does not introduce a
// second state machine. It answers three questions deterministically before an
// adapter is allowed to reach an external system:
//   1. Is a supporting adapter registered?
//   2. Are the credentials the adapter declares actually configured?
//   3. What timeout / retry / permission policy applies?

export type AdapterPermission = "OBSERVE" | "MUTATE" | "ADMIN";

export type AdapterPolicy = {
  permission: AdapterPermission;
  timeoutMs: number;
  maxAttempts: number;
  retryable: boolean;
};

// A credential requirement names the environment variable that holds a secret.
// The value is never read into a record, logged, or serialised: only whether it
// is configured is ever exposed.
export type AdapterCredentialRequirement = {
  key: string;
  envVar: string;
  required: boolean;
};

export type AdapterRegistration = {
  adapterId: string;
  policy: AdapterPolicy;
  credentials: AdapterCredentialRequirement[];
};

export type AdapterHealth = "READY" | "DEGRADED" | "UNCONFIGURED";

export type AdapterBoundaryDescriptor = {
  adapterId: string;
  observationalOnly: boolean;
  health: AdapterHealth;
  policy: AdapterPolicy;
  credentials: Array<{ key: string; required: boolean; configured: boolean }>;
};

export type AdapterResolution =
  | { ok: true; adapter: CapabilityAdapter; boundary: AdapterBoundaryDescriptor; policy: AdapterPolicy }
  | { ok: false; reason: "ADAPTER_NOT_FOUND" | "ADAPTER_UNCONFIGURED"; boundary?: AdapterBoundaryDescriptor };

// Defaults apply to adapters that have not registered an explicit boundary. They
// are deliberately read-only and allow a single retry, which is safe for a
// repeat read. Mutating adapters must register an explicit boundary.
const DEFAULT_POLICY: AdapterPolicy = { permission: "OBSERVE", timeoutMs: 15000, maxAttempts: 2, retryable: true };

const registrations = new Map<string, AdapterRegistration>();

export function registerAdapterBoundary(registration: {
  adapterId: string;
  policy?: Partial<AdapterPolicy>;
  credentials?: AdapterCredentialRequirement[];
}) {
  if (!registration.adapterId.trim()) throw new Error("CAPABILITY_ADAPTER_ID_REQUIRED");
  registrations.set(registration.adapterId, {
    adapterId: registration.adapterId,
    policy: { ...DEFAULT_POLICY, ...registration.policy },
    credentials: registration.credentials ?? [],
  });
}

export function resolveAdapterPolicy(adapterId: string): AdapterPolicy {
  return registrations.get(adapterId)?.policy ?? DEFAULT_POLICY;
}

// Only the presence of a credential is ever reported. This function must never
// return, log, or otherwise expose the value of the environment variable.
export function adapterCredentialStatus(adapterId: string) {
  const requirements = registrations.get(adapterId)?.credentials ?? [];
  return requirements.map((requirement) => ({
    key: requirement.key,
    required: requirement.required,
    configured: Boolean(process.env[requirement.envVar]?.trim()),
  }));
}

function credentialsSatisfied(adapterId: string) {
  const requirements = registrations.get(adapterId)?.credentials ?? [];
  return requirements.every((requirement) => !requirement.required || Boolean(process.env[requirement.envVar]?.trim()));
}

export function adapterHealth(adapter: CapabilityAdapter): AdapterHealth {
  if (!credentialsSatisfied(adapter.id)) return "UNCONFIGURED";
  const policy = resolveAdapterPolicy(adapter.id);
  if (policy.timeoutMs <= 0 || policy.maxAttempts < 1) return "DEGRADED";
  return "READY";
}

export function describeAdapterBoundary(adapter: CapabilityAdapter): AdapterBoundaryDescriptor {
  return {
    adapterId: adapter.id,
    observationalOnly: isObservationalAdapter(adapter),
    health: adapterHealth(adapter),
    policy: resolveAdapterPolicy(adapter.id),
    credentials: adapterCredentialStatus(adapter.id),
  };
}

// Deterministic resolution: an adapter that supports the action but whose
// required credentials are not configured is rejected here, before any external
// call, so the failure is observable and never a partial side effect.
export function resolveAdapterBoundary(action: CapabilityAction): AdapterResolution {
  const adapter = resolveCapabilityAdapter(action);
  if (!adapter) return { ok: false, reason: "ADAPTER_NOT_FOUND" };
  const boundary = describeAdapterBoundary(adapter);
  if (boundary.health === "UNCONFIGURED") return { ok: false, reason: "ADAPTER_UNCONFIGURED", boundary };
  return { ok: true, adapter, boundary, policy: boundary.policy };
}

// Retry is only permitted when the policy allows it and the attempt budget is
// not exhausted. This keeps retry deterministic and bounded.
export function withinRetryBudget(policy: AdapterPolicy, nextAttempt: number) {
  return policy.retryable && nextAttempt <= policy.maxAttempts;
}

// Built-in boundaries. Read-only adapters may be retried because a repeat read
// cannot duplicate a side effect. The webhook adapter mutates an external system
// and is therefore not auto-retryable; it also cannot run without an allowlist,
// which is enforced here before any network call.
registerAdapterBoundary({
  adapterId: "core.web-audit.v1",
  policy: { permission: "OBSERVE", timeoutMs: 15000, maxAttempts: 2, retryable: true },
});
registerAdapterBoundary({
  adapterId: "core.webhook.v1",
  policy: { permission: "MUTATE", timeoutMs: 15000, maxAttempts: 1, retryable: false },
  credentials: [
    { key: "webhook-allowlist", envVar: "CORE_ENGINE_WEBHOOK_ALLOWLIST", required: true },
    { key: "webhook-signing-secret", envVar: "CORE_ENGINE_WEBHOOK_SECRET", required: false },
  ],
});
registerAdapterBoundary({
  adapterId: "core.simulation.v1",
  policy: { permission: "OBSERVE", timeoutMs: 15000, maxAttempts: 1, retryable: true },
});
