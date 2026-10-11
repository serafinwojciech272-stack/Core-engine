// Durable agent loop (ADR-001).
// One "step" = one LLM turn plus execution of the tool calls it requested. The run is checkpointed
// after the LLM turn and after every tool result, so a crashed worker resumes exactly where it stopped:
// unanswered tool calls in the last assistant message are executed on resume, never re-planned.
import { randomUUID } from "node:crypto";
import { DEFAULT_BUDGET, normaliseCapabilities, type AgentRun, type Capability, type AgentTool, type ChatMessage, type RunBudget, type StepRecord, type ToolCall } from "@/lib/agent-loop/contracts";
import { LlmError, type LlmClient, type LlmToolSpec } from "@/lib/agent-loop/llm";
import { VersionConflictError, isTerminal, type RunStore } from "@/lib/agent-loop/store";
import { FINISH_TOOL, defaultTools } from "@/lib/agent-loop/tools";

const MAX_TOOL_OUTPUT_CHARS = 6_000;
const CONTEXT_SOFT_LIMIT_CHARS = 240_000;
const KEEP_RECENT_MESSAGES = 12;
const MAX_CONSECUTIVE_FAILURES = 4;
const MAX_TEXT_ONLY_NUDGES = 3;

export type RunnerDeps = { store: RunStore; llm: LlmClient; tools?: AgentTool[]; now?: () => number; owner?: string; leaseMs?: number };

export type CreateRunInput = { tenantId: string; goal: string; context?: string; acceptanceCriteria?: string[]; budget?: Partial<RunBudget>; requires?: unknown; playbookId?: string };

export function newRun(input: CreateRunInput): AgentRun {
  const now = new Date().toISOString();
  const goal = input.goal.trim();
  if (!goal) throw new Error("GOAL_REQUIRED");
  return {
    id: randomUUID(), tenantId: input.tenantId, goal, context: input.context?.slice(0, 50_000) || undefined,
    acceptanceCriteria: (input.acceptanceCriteria || []).map((c) => String(c).trim()).filter(Boolean).slice(0, 30),
    status: "QUEUED", budget: { ...DEFAULT_BUDGET, ...(input.budget || {}) },
    ...(normaliseCapabilities(input.requires).length ? { requires: normaliseCapabilities(input.requires) } : {}),
    ...(input.playbookId ? { playbookId: input.playbookId } : {}),
    usage: { steps: 0, promptTokens: 0, completionTokens: 0, costUsd: 0, activeMs: 0 },
    messages: [], steps: [], artifacts: [], workspace: {}, decisions: {}, consecutiveFailures: 0,
    version: 0, createdAt: now, updatedAt: now,
  };
}

function systemPrompt(run: AgentRun, tools: AgentTool[]) {
  const criteria = run.acceptanceCriteria.length ? run.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n") : "(none given — when the request is a simple question, answer it directly in plain text)";
  return [
    "You are Core Engine, an autonomous agent that works on a goal until it is fully done.",
    "Work in steps. For multi-step goals: first write PLAN.md to the workspace (numbered steps), then execute the steps with tools, updating PLAN.md progress as you go.",
    "Choose tools yourself based on what the goal needs. Never claim an action happened unless a tool result says EXECUTED.",
    "Tools marked as side effects (e.g. send_email) pause the run for human approval; if rejected or not configured, report that honestly.",
    "When every acceptance criterion is met, call `finish` with concrete evidence for each criterion. Do not call `finish` early.",
    ...(tools.some((t) => t.name === "run_command") ? ["When you write code, run it and its tests with run_command, read the failures, fix the code and re-run until the tests pass. Cite the passing run (command + exit code 0) as evidence in finish."] : ["You cannot execute code here: say explicitly that code and tests were not run."]),
    `Budget: at most ${run.budget.maxSteps} steps. Be efficient: batch independent tool calls in one turn.`,
    "Respond in the language of the goal.",
    "",
    "Acceptance criteria:", criteria,
    "",
    "Side-effect tools: " + (tools.filter((t) => t.sideEffect).map((t) => t.name).join(", ") || "none"),
  ].join("\n");
}

function toolSpecs(tools: AgentTool[]): LlmToolSpec[] {
  return [...tools.map((t) => ({ type: "function" as const, function: { name: t.name, description: t.description + (t.sideEffect ? " [SIDE EFFECT: requires human approval]" : ""), parameters: t.parameters } })),
    { type: "function", function: { name: FINISH_TOOL.name, description: FINISH_TOOL.description, parameters: FINISH_TOOL.parameters as unknown as Record<string, unknown> } }];
}

function initialMessages(run: AgentRun, tools: AgentTool[]): ChatMessage[] {
  return [
    { role: "system", content: systemPrompt(run, tools) },
    { role: "user", content: run.goal + (run.context ? "\n\nCONTEXT:\n" + run.context : "") },
  ];
}

/** Bounds context size: older tool outputs are replaced by a stub; the system prompt, goal and recent turns stay intact. */
export function compactMessages(messages: ChatMessage[]): ChatMessage[] {
  const size = (m: ChatMessage[]) => m.reduce((s, x) => s + JSON.stringify(x).length, 0);
  if (size(messages) <= CONTEXT_SOFT_LIMIT_CHARS) return messages;
  const keepFrom = Math.max(2, messages.length - KEEP_RECENT_MESSAGES);
  return messages.map((m, i) => (i >= 2 && i < keepFrom && m.role === "tool" ? { ...m, content: `[older tool output compacted: ${m.content.length} chars]` } : m));
}

function lastUnansweredToolCalls(run: AgentRun): ToolCall[] {
  for (let i = run.messages.length - 1; i >= 0; i--) {
    const m = run.messages[i];
    if (m.role === "assistant") {
      if (!m.tool_calls?.length) return [];
      const answered = new Set(run.messages.slice(i + 1).filter((x): x is Extract<ChatMessage, { role: "tool" }> => x.role === "tool").map((x) => x.tool_call_id));
      return m.tool_calls.filter((c) => !answered.has(c.id));
    }
  }
  return [];
}

function budgetExceeded(run: AgentRun): string | null {
  const b = run.budget, u = run.usage;
  if (u.steps >= b.maxSteps) return "MAX_STEPS";
  if (u.promptTokens + u.completionTokens >= b.maxTokens) return "MAX_TOKENS";
  if (u.costUsd >= b.maxCostUsd) return "MAX_COST";
  if (u.activeMs >= b.maxWallMs) return "MAX_WALL_TIME";
  return null;
}

function step(run: AgentRun, partial: Omit<StepRecord, "index" | "completedAt"> & { completedAt?: string }): StepRecord {
  return { index: run.steps.length, completedAt: new Date().toISOString(), ...partial };
}

function clip(value: unknown) {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return s.length > MAX_TOOL_OUTPUT_CHARS ? s.slice(0, MAX_TOOL_OUTPUT_CHARS) + `…[clipped ${s.length - MAX_TOOL_OUTPUT_CHARS} chars]` : s;
}

type FinishArgs = { summary?: unknown; criteria?: unknown };

function checkFinish(run: AgentRun, args: FinishArgs): { ok: true; result: NonNullable<AgentRun["result"]> } | { ok: false; reason: string } {
  const summary = typeof args.summary === "string" ? args.summary.trim() : "";
  const criteria = Array.isArray(args.criteria) ? args.criteria.map((c) => ({ criterion: String((c as Record<string, unknown>)?.criterion ?? ""), met: (c as Record<string, unknown>)?.met === true, evidence: String((c as Record<string, unknown>)?.evidence ?? "") })) : [];
  if (!summary) return { ok: false, reason: "summary is empty" };
  const unmet = criteria.filter((c) => !c.met || !c.evidence.trim());
  if (unmet.length) return { ok: false, reason: "criteria not met or missing evidence: " + unmet.map((c) => c.criterion).join("; ") };
  if (criteria.length < run.acceptanceCriteria.length) return { ok: false, reason: `report all ${run.acceptanceCriteria.length} acceptance criteria (got ${criteria.length})` };
  const missingFiles = criteria.flatMap((c) => [...c.evidence.matchAll(/workspace:([\w.\-/]+)/g)].map((m) => m[1])).filter((p) => !(p in run.workspace));
  if (missingFiles.length) return { ok: false, reason: "evidence references missing workspace files: " + missingFiles.join(", ") };
  return { ok: true, result: { summary, criteria } };
}

export class AgentRunner {
  private readonly tools: AgentTool[];
  private readonly owner: string;
  private readonly leaseMs: number;
  private readonly now: () => number;
  private readonly deps: RunnerDeps;
  /** What this worker can do; it only claims runs whose `requires` is a subset (ADR-003). */
  readonly capabilities: Capability[];
  constructor(deps: RunnerDeps) {
    this.deps = deps;
    this.tools = deps.tools ?? defaultTools();
    this.capabilities = this.tools.some((t) => t.name === "run_command") ? ["sandbox"] : [];
    this.owner = deps.owner ?? "worker-" + randomUUID().slice(0, 8);
    this.leaseMs = deps.leaseMs ?? 120_000;
    this.now = deps.now ?? Date.now;
  }

  private async save(run: AgentRun): Promise<AgentRun> {
    return this.deps.store.save({ ...run, lease: run.status === "RUNNING" ? { owner: this.owner, expiresAt: this.now() + this.leaseMs } : undefined });
  }

  /** Claims and drives runs until none are runnable or `maxRuns` were processed. */
  async drainQueue(maxRuns = Infinity) {
    let processed = 0;
    while (processed < maxRuns) {
      const run = await this.deps.store.claimNext(this.owner, this.leaseMs, this.now(), this.capabilities);
      if (!run) break;
      await this.drive(run);
      processed++;
    }
    return processed;
  }

  /** Steps a claimed (RUNNING, leased by us) run until it stops being runnable by this worker. */
  async drive(claimed: AgentRun, maxSteps = Infinity): Promise<AgentRun> {
    let run = claimed;
    let steps = 0;
    try {
      while (run.status === "RUNNING" && steps < maxSteps) {
        run = await this.advance(run);
        steps++;
        const fresh = await this.deps.store.get(run.id);
        if (fresh && (fresh.version !== run.version || fresh.status !== "RUNNING")) return fresh; // cancelled or taken over
      }
      return run;
    } catch (error) {
      if (error instanceof VersionConflictError) return (await this.deps.store.get(run.id)) ?? run;
      throw error;
    }
  }

  private async advance(input: AgentRun): Promise<AgentRun> {
    let run = input;
    if (!run.messages.length) run = await this.save({ ...run, messages: initialMessages(run, this.tools) });

    const pending = lastUnansweredToolCalls(run);
    if (pending.length) return this.executeToolCalls(run, pending);

    const exceeded = budgetExceeded(run);
    if (exceeded) return this.save({ ...run, status: "BUDGET_EXHAUSTED", error: exceeded, steps: [...run.steps, step(run, { kind: "system", startedAt: new Date().toISOString(), summary: "Budget exhausted: " + exceeded })] });

    const started = this.now();
    const startedAt = new Date().toISOString();
    const remainingTokens = run.budget.maxTokens - run.usage.promptTokens - run.usage.completionTokens;
    let response;
    try {
      response = await this.deps.llm.complete({ messages: compactMessages(run.messages), tools: toolSpecs(this.tools), maxOutputTokens: Math.max(256, Math.min(run.budget.maxOutputTokensPerCall, remainingTokens)) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const fatal = error instanceof LlmError && !error.retryable;
      const failures = run.consecutiveFailures + 1;
      const status = fatal || failures >= MAX_CONSECUTIVE_FAILURES ? "FAILED" : "RUNNING";
      return this.save({ ...run, status, error: status === "FAILED" ? message : undefined, consecutiveFailures: failures, usage: { ...run.usage, activeMs: run.usage.activeMs + (this.now() - started) }, steps: [...run.steps, step(run, { kind: "llm", startedAt, summary: "LLM call failed", error: message })] });
    }

    const usage = {
      steps: run.usage.steps + 1,
      promptTokens: run.usage.promptTokens + response.usage.promptTokens,
      completionTokens: run.usage.completionTokens + response.usage.completionTokens,
      costUsd: run.usage.costUsd + response.usage.costUsd,
      activeMs: run.usage.activeMs + (this.now() - started),
    };
    const toolCalls = (response.message.tool_calls || []).map((c, i) => ({ ...c, id: c.id || `call_${run.steps.length}_${i}` }));
    const assistant: ChatMessage = { role: "assistant", content: response.message.content, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) };
    const llmStep = step(run, { kind: "llm", startedAt, summary: toolCalls.length ? "Requested: " + toolCalls.map((c) => c.function.name).join(", ") : "Text reply", usage: response.usage });
    run = await this.save({ ...run, usage, consecutiveFailures: 0, messages: [...run.messages, assistant], steps: [...run.steps, llmStep] });

    if (response.finishReason === "length") {
      // Output hit max_tokens (typically a large file inside a tool call): any tool call is incomplete, so don't run it.
      const failures = run.consecutiveFailures + 1;
      const note = `Your previous reply was cut off at the output limit (${run.budget.maxOutputTokensPerCall} tokens) and was not executed. Split the work: one file per tool call, keep each file well under that limit.`;
      const lastAssistant = run.messages.length - 1;
      const messages = run.messages.map((m, i) => (i === lastAssistant && m.role === "assistant" ? { role: "assistant" as const, content: (m.content || "") + " [truncated]" } : m));
      return this.save({ ...run, consecutiveFailures: failures, status: failures >= MAX_CONSECUTIVE_FAILURES ? "FAILED" : "RUNNING", error: failures >= MAX_CONSECUTIVE_FAILURES ? "OUTPUT_TRUNCATED_REPEATEDLY" : undefined, messages: [...messages, { role: "user", content: note }] });
    }

    if (toolCalls.length) return this.executeToolCalls(run, toolCalls);

    const text = (response.message.content || "").trim();
    const lastToolMessage = [...run.messages].reverse().find((m) => m.role === "tool") as { content: string } | undefined;
    const lastToolFailed = Boolean(lastToolMessage?.content.startsWith('{"status":"FAILED"'));
    // Count consecutive text-only turns (a tool call in between resets the streak).
    let streak = 0;
    for (let i = run.steps.length - 1; i >= 0 && run.steps[i].kind === "llm"; i--) { if (run.steps[i].summary === "Text reply") streak++; else break; }
    // Without criteria a plain answer completes the run — unless it follows a failed tool, where the model
    // gets one nudge to try another approach; a second consecutive text reply is accepted as its final answer.
    if (!run.acceptanceCriteria.length && text && (!lastToolFailed || streak >= 2)) {
      return this.save({ ...run, status: "COMPLETED", result: { summary: text, criteria: [] } });
    }
    if (streak >= MAX_TEXT_ONLY_NUDGES) return this.save({ ...run, status: "FAILED", error: "AGENT_STOPPED_WITHOUT_FINISH" });
    const nudge = run.acceptanceCriteria.length
      ? "Continue working toward the goal using tools. Call `finish` only when every acceptance criterion is met."
      : "The last tool call failed. Continue with another approach (e.g. write the deliverable to the workspace yourself), then call `finish` with a summary.";
    return this.save({ ...run, messages: [...run.messages, { role: "user", content: nudge }] });
  }

  private async executeToolCalls(input: AgentRun, calls: ToolCall[]): Promise<AgentRun> {
    let run = input;
    for (const call of calls) {
      const startedAt = new Date().toISOString();
      const started = this.now();
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(call.function.arguments || "{}"); } catch { args = {}; }
      const name = call.function.name;

      if (name === FINISH_TOOL.name) {
        const verdict = checkFinish(run, args);
        const content = verdict.ok ? "Completion accepted." : "Completion rejected: " + verdict.reason + ". Keep working, then call finish again.";
        const next: AgentRun = {
          ...run,
          messages: [...run.messages, { role: "tool", tool_call_id: call.id, content }],
          steps: [...run.steps, step(run, { kind: "tool", startedAt, toolName: name, toolStatus: verdict.ok ? "EXECUTED" : "REJECTED", summary: content })],
        };
        run = verdict.ok ? await this.save({ ...next, status: "COMPLETED", result: verdict.result }) : await this.save(next);
        if (verdict.ok) return run;
        continue;
      }

      const tool = this.tools.find((t) => t.name === name);
      if (!tool) {
        run = await this.save({ ...run, consecutiveFailures: run.consecutiveFailures + 1, messages: [...run.messages, { role: "tool", tool_call_id: call.id, content: JSON.stringify({ status: "FAILED", error: "UNKNOWN_TOOL:" + name }) }], steps: [...run.steps, step(run, { kind: "tool", startedAt, toolName: name, toolStatus: "FAILED", summary: "Unknown tool" })] });
        continue;
      }

      if (tool.sideEffect) {
        const decision = run.decisions[call.id];
        if (!decision) {
          return this.save({
            ...run, status: "WAITING_APPROVAL",
            pendingApproval: { toolCallId: call.id, toolName: name, arguments: args, reason: tool.description, requestedAt: startedAt },
            steps: [...run.steps, step(run, { kind: "approval", startedAt, toolName: name, toolStatus: "BLOCKED", summary: "Waiting for human approval: " + name })],
          });
        }
        if (decision === "REJECTED") {
          run = await this.save({ ...run, pendingApproval: undefined, messages: [...run.messages, { role: "tool", tool_call_id: call.id, content: JSON.stringify({ status: "REJECTED", error: "HUMAN_REJECTED", executed: false }) }], steps: [...run.steps, step(run, { kind: "tool", startedAt, toolName: name, toolStatus: "REJECTED", summary: "Rejected by human" })] });
          continue;
        }
      }

      let status: "EXECUTED" | "FAILED" = "FAILED";
      let output: unknown;
      let artifacts = run.artifacts;
      let workspace = run.workspace;
      try {
        const result = await tool.execute(args, { run });
        status = result.status;
        output = result.output;
        if (result.artifacts?.length) artifacts = [...artifacts, ...result.artifacts.map((a) => ({ ...a, id: randomUUID(), createdAt: new Date().toISOString() }))];
        if (result.workspaceWrites) workspace = { ...workspace, ...result.workspaceWrites };
      } catch (error) {
        output = { error: error instanceof Error ? error.message : String(error) };
      }
      const failures = status === "EXECUTED" ? 0 : run.consecutiveFailures + 1;
      run = await this.save({
        ...run, artifacts, workspace, pendingApproval: undefined,
        consecutiveFailures: failures,
        status: failures >= MAX_CONSECUTIVE_FAILURES * 2 ? "FAILED" : run.status,
        error: failures >= MAX_CONSECUTIVE_FAILURES * 2 ? "TOO_MANY_TOOL_FAILURES" : run.error,
        usage: { ...run.usage, activeMs: run.usage.activeMs + (this.now() - started) },
        messages: [...run.messages, { role: "tool", tool_call_id: call.id, content: clip({ status, output }) }],
        steps: [...run.steps, step(run, { kind: "tool", startedAt, toolName: name, toolStatus: status, summary: `${name} → ${status}` })],
      });
      if (run.status !== "RUNNING") return run;
    }
    return run;
  }
}

// ---- Commands used by the API (no LLM involved) ----

export async function decideApproval(store: RunStore, id: string, tenantId: string, decision: "APPROVED" | "REJECTED") {
  const run = await store.get(id);
  if (!run || run.tenantId !== tenantId) throw new Error("RUN_NOT_FOUND");
  if (run.status !== "WAITING_APPROVAL" || !run.pendingApproval) throw new Error("RUN_NOT_WAITING_APPROVAL");
  return store.save({ ...run, status: "QUEUED", decisions: { ...run.decisions, [run.pendingApproval.toolCallId]: decision } });
}

export async function cancelRun(store: RunStore, id: string, tenantId: string) {
  const run = await store.get(id);
  if (!run || run.tenantId !== tenantId) throw new Error("RUN_NOT_FOUND");
  if (isTerminal(run)) return run;
  return store.save({ ...run, status: "CANCELLED", lease: undefined });
}

/** Re-queues a run stopped by budget or failure, optionally with extra budget. */
export async function resumeRun(store: RunStore, id: string, tenantId: string, extra: Partial<RunBudget> = {}) {
  const run = await store.get(id);
  if (!run || run.tenantId !== tenantId) throw new Error("RUN_NOT_FOUND");
  if (!["BUDGET_EXHAUSTED", "FAILED"].includes(run.status)) throw new Error("RUN_NOT_RESUMABLE");
  const budget = { ...run.budget };
  for (const [k, v] of Object.entries(extra)) if (typeof v === "number" && v > 0) budget[k as keyof RunBudget] += v;
  return store.save({ ...run, status: "QUEUED", budget, error: undefined, consecutiveFailures: 0 });
}
