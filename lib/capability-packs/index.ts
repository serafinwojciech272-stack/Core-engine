import { registerWordPressCapabilityPacks } from "@/lib/capability-packs/wordpress";
import { registerIntegrationCapabilityPack } from "@/lib/capability-packs/integrations";
import { registerCognitionCapabilityPack } from "@/lib/capability-packs/cognition";

let initialized = false;
export function ensureCapabilityPacks() {
  if (!initialized) {
    registerWordPressCapabilityPacks();
    registerIntegrationCapabilityPack();
    registerCognitionCapabilityPack();
    initialized = true;
  }
}
