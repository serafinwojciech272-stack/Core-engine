import type { Context, Signal } from "@/lib/core-contracts";

export type RawSignal = {
  name: string;
  value: string;
  source: string;
  timestamp?: string;
  metadata?: Record<string, string>;
};

function clean(value: string, max: number) {
  return value.trim().slice(0, max);
}

export function buildContext(
  rawSignals: RawSignal[],
  domain?: string,
  metadata: Record<string, string> = {}
): Context {
  const signals: Signal[] = rawSignals.map((raw) => ({
    name: clean(raw.name, 100),
    value: clean(raw.value, 200),
    source: clean(raw.source, 100),
    observedAt: raw.timestamp,
    metadata: raw.metadata
  }));

  return {
    domain: domain?.trim().slice(0, 40) || "default",
    signals,
    metadata: Object.fromEntries(
      Object.entries(metadata).map(([key, value]) => [clean(key, 80), clean(value, 200)])
    )
  };
}

export function validateContext(context: Context): void {
  if (!Array.isArray(context.signals) || context.signals.length === 0) {
    throw new Error("CONTEXT_SIGNALS_REQUIRED");
  }
  if (context.signals.length > 30) {
    throw new Error("CONTEXT_TOO_MANY_SIGNALS");
  }
  for (const signal of context.signals) {
    if (!signal.name || !signal.value || !signal.source) {
      throw new Error("CONTEXT_INVALID_SIGNAL");
    }
  }
}
