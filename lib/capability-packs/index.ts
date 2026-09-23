import { registerWordPressCapabilityPacks } from "@/lib/capability-packs/wordpress";

let initialized = false;

export function ensureCapabilityPacks() {
  if (!initialized) {
    registerWordPressCapabilityPacks();
    initialized = true;
  }
}
