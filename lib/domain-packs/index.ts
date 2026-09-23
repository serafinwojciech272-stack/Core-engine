import { registerDomainPack } from "@/lib/domain-registry";
import { businessDomainPack } from "@/lib/domain-packs/business";

let initialized = false;

export function ensureBuiltInDomainPacks() {
  if (initialized) return;
  registerDomainPack(businessDomainPack);
  initialized = true;
}

export function resetBuiltInDomainPacksForTests() {
  initialized = false;
}
