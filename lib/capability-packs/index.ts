import { registerWordPressCapabilityPacks } from "@/lib/capability-packs/wordpress";
import { registerIntegrationCapabilityPack } from "@/lib/capability-packs/integrations";

let initialized = false;
export function ensureCapabilityPacks() {
  if (!initialized) {
    registerWordPressCapabilityPacks();
    registerIntegrationCapabilityPack();
    initialized = true;
  }
}
