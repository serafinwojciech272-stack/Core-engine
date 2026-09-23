import { registerDomainPack } from "@/lib/domain-registry";
import { businessDomainPack } from "@/lib/domain-packs/business";
import { tradingDomainPack } from "@/lib/domain-packs/trading";
import { tenderDomainPack } from "@/lib/domain-packs/tender";

let initialized = false;

export function ensureBuiltInDomainPacks() {
  if (initialized) return;
  registerDomainPack(businessDomainPack);
  registerDomainPack(tradingDomainPack);
  registerDomainPack(tenderDomainPack);
  initialized = true;
}

export function resetBuiltInDomainPacksForTests() {
  initialized = false;
}
