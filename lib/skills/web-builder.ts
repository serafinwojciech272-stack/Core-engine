import type { SkillDefinition } from "./types";

export const webBuilderSkill: SkillDefinition = {
  id: "web.fullstack-builder",
  version: "1.0.0",
  name: "Full Stack Web Builder",
  description: "Plan, build, test, verify and deploy production web experiences and applications.",
  domain: "software",
  capabilities: [
    { id: "requirements.analyze", description: "Convert a product request into a testable specification.", riskLevel: "LOW", modes: ["OBSERVATIONAL", "SIMULATION"], requiredTools: ["planner"] },
    { id: "ux.design", description: "Create information architecture and UI design specifications.", riskLevel: "LOW", modes: ["OBSERVATIONAL", "SIMULATION"], requiredTools: ["design-tools"] },
    { id: "code.build", description: "Generate and modify application source code.", riskLevel: "MEDIUM", modes: ["SIMULATION", "SHADOW"], requiredTools: ["github"] },
    { id: "browser.verify", description: "Run browser-level visual and functional verification.", riskLevel: "MEDIUM", modes: ["SIMULATION", "SHADOW"], requiredTools: ["browser"] },
    { id: "deploy.execute", description: "Deploy a verified artifact through an approved provider.", riskLevel: "HIGH", modes: ["SHADOW", "LIVE"], requiredTools: ["vercel", "render"] }
  ],
  policies: [
    "Never deploy unverified source.",
    "Secrets stay outside source control.",
    "Production changes require build, typecheck, lint and E2E verification."
  ],
  verification: ["typecheck", "lint", "unit-tests", "build", "browser-e2e", "security", "performance"],
  learningPolicy: "Persist build failures, UX defects and deployment outcomes as reusable engineering lessons."
};
