export type TaskComplexity = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type IntelligenceMode = "single" | "escalation" | "consensus";

export type ModelProfile = {
  id: string;
  family: string;
  role: "fast" | "balanced" | "expert" | "judge";
  strengths: string[];
  complexityMin: number;
  complexityMax: number;
  costClass: "low" | "medium" | "high";
};

const MODEL_PROFILES: ModelProfile[] = [
  { id: "openai/gpt-5.6-luna", family: "openai", role: "balanced", strengths: ["general", "reasoning", "structured"], complexityMin: 1, complexityMax: 8, costClass: "medium" },
  { id: "anthropic/claude-sonnet-5.5", family: "anthropic", role: "expert", strengths: ["coding", "documents", "reasoning", "agentic"], complexityMin: 5, complexityMax: 10, costClass: "high" },
  { id: "x-ai/grok-4.7", family: "xai", role: "expert", strengths: ["coding", "research", "reasoning", "agentic"], complexityMin: 5, complexityMax: 10, costClass: "high" },
  { id: "moonshotai/kimi-k3", family: "kimi", role: "expert", strengths: ["coding", "multimodal", "long-context", "agentic"], complexityMin: 6, complexityMax: 10, costClass: "high" },
  { id: "google/gemini-3.8-flash", family: "google", role: "fast", strengths: ["multimodal", "analysis", "agentic", "speed"], complexityMin: 2, complexityMax: 8, costClass: "medium" }
];

function env(name: string) { return process.env[name]?.trim() || ""; }

export function classifyTaskComplexity(task: string): { complexity: TaskComplexity; domain: string; reasons: string[] } {
  const t = task.toLowerCase();
  const reasons: string[] = [];
  let score = 2;
  let domain = "general";

  if (/(kod|repo|bug|debug|architektur|implement|refaktor|api|typescript|javascript)/.test(t)) { score += 2; domain = "coding"; reasons.push("technical"); }
  if (/(strateg|biznes|finans|trading|inwest|ryzyko|praw|medycz|high.?stakes)/.test(t)) { score += 3; domain = "high-stakes"; reasons.push("high-stakes"); }
  if (/(research|zbadaj|konkurenc|rynek|źródła|sources|porównaj)/.test(t)) { score += 2; domain = "research"; reasons.push("research"); }
  if (/(plik|pdf|xlsx|csv|dokument|obraz|video|multimodal)/.test(t)) { score += 1; reasons.push("multimodal"); }
  if (/(wielu|multi|porównaj.*modele|consensus|zweryfikuj.*niezależnie)/.test(t)) { score += 2; reasons.push("multi-agent"); }
  if (t.length > 1600) { score += 1; reasons.push("long-context"); }
  score = Math.max(1, Math.min(10, score));
  return { complexity: score as TaskComplexity, domain, reasons };
}

export function selectIntelligenceMode(complexity: TaskComplexity, task: string): IntelligenceMode {
  const forced = env("CORE_ENGINE_INTELLIGENCE_MODE").toLowerCase();
  if (forced === "single" || forced === "escalation" || forced === "consensus") return forced;
  if (complexity >= 9 || /(^|\s)(consensus|multi.?model|second opinion|second opinions)(\s|$)/i.test(task)) return "consensus";
  if (complexity >= 6) return "escalation";
  return "single";
}

export function modelRegistry() {
  return MODEL_PROFILES.map(m => ({ ...m }));
}

export function intelligenceReadiness() {
  return {
    mAI01: "READY",
    mAI02: "READY",
    mAI03: "READY",
    models: modelRegistry(),
    routing: {
      mode: "task-aware",
      override: "CORE_ENGINE_INTELLIGENCE_MODE",
      consensus: "complexity>=9 or explicit consensus",
      escalation: "complexity>=6"
    }
  };
}
