import type { DomainPack, DomainId } from "@/lib/core-contracts";

const registry = new Map<DomainId, DomainPack>();

export function registerDomainPack(pack: DomainPack): DomainPack {
  if (!pack.id.trim()) throw new Error("DOMAIN_ID_REQUIRED");
  if (!pack.version.trim()) throw new Error("DOMAIN_VERSION_REQUIRED");
  registry.set(pack.id, pack);
  return pack;
}

export function getDomainPack(id?: string): DomainPack | undefined {
  if (!id) return undefined;
  return registry.get(id);
}

export function listDomainPacks(): DomainPack[] {
  return [...registry.values()];
}

export function requireDomainPack(id: string): DomainPack {
  const pack = getDomainPack(id);
  if (!pack) throw new Error("DOMAIN_PACK_NOT_REGISTERED:" + id);
  return pack;
}

export function clearDomainRegistryForTests() {
  registry.clear();
}
