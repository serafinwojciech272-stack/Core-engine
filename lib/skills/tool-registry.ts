import type { SkillMode } from "./types";

export type ToolRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ToolDefinition = {
  id: string;
  version: string;
  name: string;
  description: string;
  riskLevel: ToolRiskLevel;
  modes: SkillMode[];
  capabilities: string[];
  serverOnly?: boolean;
};

const registry = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition): void {
  if (!tool.id || !tool.version) throw new Error("INVALID_TOOL_DEFINITION");
  if (registry.has(tool.id)) throw new Error(`TOOL_ALREADY_REGISTERED:${tool.id}`);
  registry.set(tool.id, tool);
}

export function getTool(id: string): ToolDefinition | null {
  return registry.get(id) ?? null;
}

export function listTools(): ToolDefinition[] {
  return [...registry.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function clearToolRegistryForTests(): void {
  registry.clear();
}

export const coreTools: ToolDefinition[] = [
  { id: "planner", version: "1.0.0", name: "Planner", description: "Deterministic planning capability.", riskLevel: "LOW", modes: ["OBSERVATIONAL", "SIMULATION", "SHADOW", "LIVE"], capabilities: ["planning"] },
  { id: "skill-registry", version: "1.0.0", name: "Skill Registry", description: "Read registered skill definitions.", riskLevel: "LOW", modes: ["OBSERVATIONAL", "SIMULATION", "SHADOW", "LIVE"], capabilities: ["skill.read"] },
  { id: "tool-registry", version: "1.0.0", name: "Tool Registry", description: "Read approved tool definitions.", riskLevel: "LOW", modes: ["OBSERVATIONAL", "SIMULATION", "SHADOW", "LIVE"], capabilities: ["tool.read"] },
  { id: "market-data", version: "1.0.0", name: "Market Data", description: "External market/account observation adapter.", riskLevel: "MEDIUM", modes: ["OBSERVATIONAL", "SIMULATION", "SHADOW", "LIVE"], capabilities: ["market.read"], serverOnly: true },
  { id: "risk-engine", version: "1.0.0", name: "Risk Engine", description: "Pre-trade risk and policy evaluation.", riskLevel: "HIGH", modes: ["SIMULATION", "SHADOW", "LIVE"], capabilities: ["risk.evaluate"], serverOnly: true },
  { id: "broker-adapter", version: "0.1.0", name: "Broker Adapter Contract", description: "Interface boundary only; no broker implementation or credentials.", riskLevel: "CRITICAL", modes: ["SHADOW", "LIVE"], capabilities: ["trade.execute", "trade.monitor", "trade.reconcile"], serverOnly: true },
  { id: "ledger", version: "1.0.0", name: "Trade Ledger", description: "Durable trade evidence and reconciliation ledger.", riskLevel: "HIGH", modes: ["SHADOW", "LIVE"], capabilities: ["trade.reconcile"], serverOnly: true },
  { id: "github", version: "1.0.0", name: "GitHub", description: "Source-control operations.", riskLevel: "HIGH", modes: ["SIMULATION", "SHADOW", "LIVE"], capabilities: ["code.build"], serverOnly: true },
  { id: "browser", version: "1.0.0", name: "Browser QA", description: "Browser verification and extraction.", riskLevel: "MEDIUM", modes: ["SIMULATION", "SHADOW"], capabilities: ["browser.verify"], serverOnly: true },
  { id: "vercel", version: "1.0.0", name: "Vercel", description: "Frontend deployment boundary.", riskLevel: "HIGH", modes: ["SHADOW", "LIVE"], capabilities: ["deploy.execute"], serverOnly: true },
  { id: "render", version: "1.0.0", name: "Render", description: "Backend deployment boundary.", riskLevel: "HIGH", modes: ["SHADOW", "LIVE"], capabilities: ["deploy.execute"], serverOnly: true },
  { id: "design-tools", version: "1.0.0", name: "Design Tools", description: "UI/UX design tool boundary.", riskLevel: "MEDIUM", modes: ["OBSERVATIONAL", "SIMULATION"], capabilities: ["ux.design"] },
  { id: "evaluation", version: "1.0.0", name: "Evaluation", description: "Deterministic and scenario evaluation.", riskLevel: "MEDIUM", modes: ["SIMULATION", "SHADOW"], capabilities: ["agent.evaluate"] },
  { id: "approval", version: "1.0.0", name: "Approval Gate", description: "Human approval boundary.", riskLevel: "HIGH", modes: ["SHADOW", "LIVE"], capabilities: ["agent.promote"] },
  { id: "audit", version: "1.0.0", name: "Audit", description: "Execution audit boundary.", riskLevel: "HIGH", modes: ["SHADOW", "LIVE"], capabilities: ["agent.promote"] }
];