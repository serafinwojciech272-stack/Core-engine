import { registerWordPressCapabilityPacks } from "@/lib/capability-packs/wordpress";
import { registerExternalActionPack } from "@/lib/capability-packs/external-actions";

let initialized = false;

export function ensureCapabilityPacks() {
  if (!initialized) {
    registerWordPressCapabilityPacks();
    registerExternalActionPack();
    initialized = true;
  }
}