import type { Decision } from "@/lib/engine";
import { createLlmClient, type LlmClient } from "@/lib/cognition/llm-client";
import { renderCognitionPrompt } from "@/lib/cognition/prompt-registry";

export type UnderstandResult = { summary: string; signals: unknown[]; requirements: unknown[]; deadlines: unknown[]; criteria: unknown[]; unknowns: unknown[]; confidence_notes: string[] };
export type DecisionSynthesis = { diagnosis: string; recommendation: string };
export type LearningDraft = { lesson: string; evidence: unknown[]; conditions: unknown[]; limitations: unknown[]; follow_up_test: string; requiresHumanApproval: true };

function parseObject(content: string): Record<string, unknown> {
  try { const parsed = JSON.parse(content) as unknown; if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); return parsed as Record<string, unknown>; }
  catch { throw new Error("LLM_STRUCTURED_OUTPUT_INVALID"); }
}
function stringValue(value: unknown) { return typeof value === "string" ? value : ""; }
function arrayValue(value: unknown) { return Array.isArray(value) ? value : []; }

export async function understand(input: { tenantId: string; missionId?: string; text: string; client?: LlmClient }) {
  const prompt = renderCognitionPrompt("UNDERSTAND", { input: input.text.slice(0, 50_000) });
  const result = await (input.client ?? createLlmClient()).complete({ messages: prompt.messages, temperature: 0, audit: { tenantId: input.tenantId, missionId: input.missionId, operation: "understand", promptName: prompt.name, promptVersion: prompt.version, promptHash: prompt.hash } });
  const parsed = parseObject(result.content);
  return { summary: stringValue(parsed.summary), signals: arrayValue(parsed.signals), requirements: arrayValue(parsed.requirements), deadlines: arrayValue(parsed.deadlines), criteria: arrayValue(parsed.criteria), unknowns: arrayValue(parsed.unknowns), confidence_notes: arrayValue(parsed.confidence_notes).filter((x): x is string => typeof x === "string") } satisfies UnderstandResult;
}

export async function decide(input: { tenantId: string; missionId?: string; context: unknown; deterministicDecision: Decision; client?: LlmClient }) {
  const prompt = renderCognitionPrompt("DECIDE", { decision: JSON.stringify(input.deterministicDecision), context: JSON.stringify(input.context) });
  const result = await (input.client ?? createLlmClient()).complete({ messages: prompt.messages, temperature: 0, audit: { tenantId: input.tenantId, missionId: input.missionId, operation: "decide", promptName: prompt.name, promptVersion: prompt.version, promptHash: prompt.hash } });
  const parsed = parseObject(result.content);
  return { ...input.deterministicDecision, diagnosis: stringValue(parsed.diagnosis), recommendation: stringValue(parsed.recommendation), reasoningSource: "LLM" as const };
}

export async function learn(input: { tenantId: string; missionId?: string; outcome: unknown; client?: LlmClient }) {
  const prompt = renderCognitionPrompt("LEARN", { outcome: JSON.stringify(input.outcome) });
  const result = await (input.client ?? createLlmClient()).complete({ messages: prompt.messages, temperature: 0, audit: { tenantId: input.tenantId, missionId: input.missionId, operation: "learn", promptName: prompt.name, promptVersion: prompt.version, promptHash: prompt.hash } });
  const parsed = parseObject(result.content);
  return { lesson: stringValue(parsed.lesson), evidence: arrayValue(parsed.evidence), conditions: arrayValue(parsed.conditions), limitations: arrayValue(parsed.limitations), follow_up_test: stringValue(parsed.follow_up_test), requiresHumanApproval: true as const } satisfies LearningDraft;
}
