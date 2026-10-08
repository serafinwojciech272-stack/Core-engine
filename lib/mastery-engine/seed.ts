import type { MasteryProfile, MasteryRoadmap, RoadmapStage, SkillState } from "./contracts";

const skill = (
  id: string,
  name: string,
  domain: SkillState["domain"],
  prerequisites: string[] = []
): SkillState => ({
  id,
  name,
  domain,
  level: 0,
  target: 5,
  confidence: 0,
  gap: 5,
  prerequisites,
  evidenceCount: 0,
  lastVerifiedAt: null,
  nextAction: "Baseline assessment"
});

export function seedMasteryProfile(now = new Date().toISOString()): MasteryProfile {
  const skills = [
    skill("python", "Python", "computer-science"),
    skill("typescript", "TypeScript", "computer-science"),
    skill("sql", "SQL and PostgreSQL", "computer-science"),
    skill("apis", "APIs and distributed systems", "computer-science"),
    skill("linear-algebra", "Linear algebra", "mathematics"),
    skill("probability", "Probability and statistics", "mathematics"),
    skill("ml", "Machine learning", "machine-learning"),
    skill("deep-learning", "Deep learning", "deep-learning", ["ml"]),
    skill("llm", "LLM engineering", "llm-engineering", ["apis"]),
    skill("rag", "RAG and retrieval", "llm-engineering", ["llm", "sql"]),
    skill("tool-calling", "Tool calling", "llm-engineering", ["llm"]),
    skill("agents", "Agent engineering", "agent-engineering", ["llm", "tool-calling"]),
    skill("agent-evals", "Agent evaluation", "agent-engineering", ["agents"]),
    skill("ai-infra", "AI infrastructure", "ai-infrastructure", ["apis", "llm"]),
    skill("ai-products", "AI product engineering", "ai-product", ["llm", "ai-infra"]),
    skill("research", "AI research literacy", "ai-research"),
    skill("business", "AI business and monetization", "ai-business", ["ai-products"])
  ];
  return {
    version: "PROFILE v1.0",
    currentLevel: "UNASSESSED",
    overall: 0,
    target: 5,
    domains: Object.fromEntries([...new Set(skills.map(s => s.domain))].map(d => [d, 0])),
    skills,
    strengths: [],
    gaps: ["Baseline assessment required"],
    blockers: [],
    updatedAt: now
  };
}

const stage = (
  id: string,
  year: number,
  quarter: string,
  title: string,
  objective: string,
  skills: string[],
  project: string,
  evidence: string[],
  monetization: string
): RoadmapStage => ({
  id, year, quarter, title, objective, skills, project, evidence, monetization,
  status: year === 2026 ? "READY" : "LOCKED"
});

export function seedMasteryRoadmap(now = new Date().toISOString()): MasteryRoadmap {
  return {
    version: "ROADMAP v1.0",
    horizon: "2026-2031",
    generatedAt: now,
    strategy: "Build -> verify -> ship -> monetize -> teach.",
    stages: [
      stage("M1", 2026, "Q4", "AI Engineering Foundations", "Build strong software and LLM fundamentals.", ["python", "typescript", "apis", "llm"], "Production LLM workspace", ["working API", "tests", "cost log"], "First small AI automation offer"),
      stage("M2", 2027, "Q1", "LLM Engineering", "Master context, structured output, RAG and routing.", ["llm", "rag", "tool-calling"], "Evidence-backed RAG system", ["retrieval eval", "structured output", "latency report"], "RAG implementation service"),
      stage("M3", 2027, "Q2", "Agent Engineering", "Build reliable tool-using agents.", ["agents", "agent-evals"], "Production agent with recovery", ["eval suite", "failure recovery", "audit trail"], "Agent automation projects"),
      stage("M4", 2027, "Q3", "AI Infrastructure", "Understand reliability, cost and model routing.", ["ai-infra", "ai-evals"], "Model routing control plane", ["fallback test", "cost benchmark", "observability"], "AI infrastructure consulting"),
      stage("M5", 2028, "Q1", "AI Systems Architecture", "Design multi-component AI systems.", ["agents", "ai-infra", "ai-products"], "Multi-agent operating system", ["architecture review", "load test", "policy test"], "Enterprise AI systems"),
      stage("M6", 2028, "Q3", "AI Product Engineering", "Turn capabilities into repeatable products.", ["ai-products", "business"], "AI SaaS product", ["activation", "retention", "unit economics"], "SaaS revenue"),
      stage("M7", 2029, "Q1", "AI Research Intelligence", "Read, test and operationalize new research.", ["research", "deep-learning"], "Personal AI research lab", ["paper replications", "benchmarks"], "Research-driven product advantage"),
      stage("M8", 2029, "Q3", "Career and Commercial Scale", "Package expertise into repeatable offers.", ["business", "ai-products"], "AI expertise platform", ["case studies", "pricing", "distribution"], "Consulting + products"),
      stage("M9", 2030, "Q1", "Advanced Agent Systems", "Operate durable autonomous workflows.", ["agents", "agent-evals", "ai-infra"], "Durable agent runtime", ["long-run evals", "recovery", "cost control"], "Advanced agent systems"),
      stage("M10", 2030, "Q3", "AI Platform Architecture", "Design reusable AI infrastructure.", ["ai-infra", "ai-products"], "Reusable AI platform", ["multi-tenant", "security", "SLOs"], "Platform licensing"),
      stage("M11", 2031, "Q1", "Expert Builder", "Combine engineering, research and business.", ["research", "ai-products", "business"], "Flagship AI system", ["production evidence", "benchmark", "commercial result"], "High-value AI products"),
      stage("M12", 2031, "Q3", "AI Systems Architect", "Lead and teach advanced AI system design.", ["research", "agents", "ai-infra", "business"], "Public mastery platform", ["public portfolio", "peer validation"], "Education + platform + products")
    ],
    nextAction: "Run baseline assessment.",
    assumptions: [
      "The user learns primarily through building.",
      "Core Engine remains the central AI infrastructure.",
      "The roadmap adapts to technology changes rather than following a fixed curriculum."
    ],
    changes: []
  };
}
