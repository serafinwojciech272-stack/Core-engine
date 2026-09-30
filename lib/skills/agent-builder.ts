import type { SkillDefinition } from "./types";

export const agentBuilderSkill: SkillDefinition = {
  id: "agent.builder",
  version: "1.0.0",
  name: "Agent Builder",
  description: "Define, compose, verify and govern specialized agents from reusable skills and tools.",
  domain: "agents",
  capabilities: [
    { id: "agent.specify", description: "Convert a goal into agent requirements and acceptance criteria.", riskLevel: "LOW", modes: ["OBSERVATIONAL", "SIMULATION"], requiredTools: ["planner"] },
    { id: "agent.compose", description: "Compose skills, tools, memory and policies into an agent definition.", riskLevel: "MEDIUM", modes: ["SIMULATION"], requiredTools: ["skill-registry", "tool-registry"] },
    { id: "agent.evaluate", description: "Evaluate an agent against deterministic and scenario-based tests.", riskLevel: "MEDIUM", modes: ["SIMULATION", "SHADOW"], requiredTools: ["evaluation"] },
    { id: "agent.promote", description: "Promote a verified agent configuration through an approval gate.", riskLevel: "HIGH", modes: ["SHADOW", "LIVE"], requiredTools: ["approval", "audit"] }
  ],
  policies: [
    "An agent inherits the strictest risk policy of its enabled skills.",
    "Critical capabilities require explicit approval before live execution.",
    "Agent versions and tool permissions are immutable for each execution record."
  ],
  verification: ["schema-validation", "capability-tests", "policy-tests", "sandbox-e2e", "approval-gate"],
  learningPolicy: "Learn from agent evaluation and outcome evidence without silently changing production policy."
};
