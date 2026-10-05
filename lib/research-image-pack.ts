import { registerCapabilityPack } from "@/lib/capability-registry";

registerCapabilityPack({
  id: "core.research-image.v1",
  name: "Research and Image Providers",
  version: "1.0.0",
  category: "INTEGRATION",
  inspiredBy: ["Serper", "External Image Provider"],
  description: "Governed web evidence collection and external image execution.",
  capabilities: ["web-evidence", "image-generation"],
  actions: [
    { id: "web.research.collect", name: "Collect web evidence", description: "Search the web and normalize source evidence.", risk: "MEDIUM", requiresApproval: true, inputs: ["query", "limit"], outputs: ["evidence"] },
    { id: "image.generate", name: "Generate or transform image", description: "Execute an approved image provider request.", risk: "HIGH", requiresApproval: true, inputs: ["prompt", "operation", "image"], outputs: ["url", "provider"] }
  ],
  signals: ["RESEARCH", "WEB", "EVIDENCE", "IMAGE", "CREATIVE"],
  diagnostics: ["provider-readiness", "source-reliability"],
  metrics: ["evidence-collected", "image-generated"]
});

export function ensureResearchImagePack(){ return true; }
