import { createHash } from "node:crypto";

export type CognitionPromptName = "UNDERSTAND" | "DECIDE" | "LEARN";
export type CognitionPrompt = { name: CognitionPromptName; version: string; system: string; userTemplate: string; hash: string };

const prompts: Record<CognitionPromptName, Omit<CognitionPrompt, "hash">> = {
  UNDERSTAND: {
    name: "UNDERSTAND", version: "1.0.0",
    system: "You are the Core Engine cognition layer. Extract structured business signals from unstructured input. Do not invent facts. Mark uncertainty explicitly.",
    userTemplate: "Analyze the following input and return JSON with summary, signals, requirements, deadlines, criteria, unknowns, and confidence_notes.\n\nINPUT:\n{{input}}",
  },
  DECIDE: {
    name: "DECIDE", version: "1.0.0",
    system: "You are the Core Engine diagnostic layer. The deterministic decision is authoritative. Produce only natural-language diagnosis and recommendation. Never change numeric values, confidence, probabilities, expectedR, riskGate, priority, or evidence.",
    userTemplate: "Given the deterministic decision below and its context, produce JSON with diagnosis and recommendation only.\n\nDETERMINISTIC_DECISION:\n{{decision}}\n\nCONTEXT:\n{{context}}",
  },
  LEARN: {
    name: "LEARN", version: "1.0.0",
    system: "You are the Core Engine learning assistant. Draft a reusable lesson from an observed outcome. Do not promote, persist, or change strategy state. A human must approve the lesson before durable learning.",
    userTemplate: "Draft JSON with lesson, evidence, conditions, limitations, and follow_up_test from this outcome.\n\nOUTCOME:\n{{outcome}}",
  },
};

export function getCognitionPrompt(name: CognitionPromptName): CognitionPrompt {
  const prompt = prompts[name];
  return { ...prompt, hash: createHash("sha256").update(JSON.stringify(prompt)).digest("hex") };
}

export function renderCognitionPrompt(name: CognitionPromptName, variables: Record<string, string>) {
  const prompt = getCognitionPrompt(name);
  let user = prompt.userTemplate;
  for (const [key, value] of Object.entries(variables)) user = user.replaceAll("{{" + key + "}}", value);
  return { ...prompt, messages: [{ role: "system" as const, content: prompt.system }, { role: "user" as const, content: user }] };
}
