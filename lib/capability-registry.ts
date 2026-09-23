import type { CapabilityPack } from "@/lib/capability-contracts";
import { validateCapabilityPack } from "@/lib/capability-contracts";

const registry = new Map<string, CapabilityPack>();

export function registerCapabilityPack(pack: CapabilityPack) {
  const result = validateCapabilityPack(pack);
  if (!result.valid) throw new Error(result.errors.join(","));
  registry.set(pack.id, pack);
  return pack;
}

export function getCapabilityPack(id: string) { return registry.get(id); }
export function listCapabilityPacks() { return [...registry.values()]; }

export function findCapabilities(query: string) {
  const q = query.toLowerCase().trim();
  return listCapabilityPacks().filter((pack) =>
    [pack.id, pack.name, pack.category, pack.description, ...pack.capabilities, ...pack.signals]
      .join(" ").toLowerCase().includes(q)
  );
}

export function clearCapabilityRegistryForTests() { registry.clear(); }
