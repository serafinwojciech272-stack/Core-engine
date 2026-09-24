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

const adapters: CapabilityAdapter[] = [simulationAdapter];

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
