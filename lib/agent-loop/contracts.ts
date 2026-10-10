// Contracts for the durable agent loop (ADR-001).
// A run is persisted after every step, so any worker can resume it from the last checkpoint.

export type RunStatus =
  | "QUEUED"            // created, waiting for a worker
  | "RUNNING"           // a worker holds the lease and is stepping
  | "WAITING_APPROVAL"  // paused on a side-effecting tool call; needs a human decision
  | "COMPLETED"         // model called `finish` and the completion gate passed
  | "FAILED"            // unrecoverable error or repeated failures
  | "BUDGET_EXHAUSTED"  // step/token/cost/time budget reached before completion
  | "CANCELLED";

export const TERMINAL_STATUSES: readonly RunStatus[] = ["COMPLETED", "FAILED", "BUDGET_EXHAUSTED", "CANCELLED"];

export type RunBudget = {
  maxSteps: number;        // LLM turns
  maxTokens: number;       // prompt + completion tokens across the run
  maxCostUsd: number;
  maxWallMs: number;       // wall-clock since the run started (excludes time waiting for approval)
  maxOutputTokensPerCall: number;
};

export const DEFAULT_BUDGET: RunBudget = {
  maxSteps: 40,
  maxTokens: 400_000,
  maxCostUsd: 2,
  maxWallMs: 30 * 60_000,
  maxOutputTokensPerCall: 16_000,
};

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type StepRecord = {
  index: number;
  kind: "llm" | "tool" | "approval" | "system";
  startedAt: string;
  completedAt: string;
  summary: string;
  toolName?: string;
  toolStatus?: "EXECUTED" | "FAILED" | "BLOCKED" | "REJECTED";
  usage?: { promptTokens: number; completionTokens: number; costUsd: number };
  error?: string;
};

export type RunArtifact = {
  id: string;
  name: string;
  type: "website" | "file" | "data" | "image" | "video" | "text";
  mimeType?: string;
  createdAt: string;
  provider?: string;
  // Small artifacts are stored inline; large binary payloads keep a data URL.
  content?: string;
  dataUrl?: string;
};

export type PendingApproval = {
  toolCallId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  reason: string;
  requestedAt: string;
};

export type AgentRun = {
  id: string;
  tenantId: string;
  goal: string;
  context?: string;
  acceptanceCriteria: string[];
  status: RunStatus;
  budget: RunBudget;
  usage: { steps: number; promptTokens: number; completionTokens: number; costUsd: number; activeMs: number };
  messages: ChatMessage[];
  steps: StepRecord[];
  artifacts: RunArtifact[];
  workspace: Record<string, string>; // virtual files written by the agent (spec, schema, code…)
  pendingApproval?: PendingApproval;
  decisions: Record<string, "APPROVED" | "REJECTED">; // human decisions keyed by tool call id
  result?: { summary: string; criteria: Array<{ criterion: string; met: boolean; evidence: string }> };
  error?: string;
  consecutiveFailures: number;
  lease?: { owner: string; expiresAt: number };
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ToolContext = { run: AgentRun; signal?: AbortSignal };

export type ToolResult = {
  status: "EXECUTED" | "FAILED";
  output: unknown;               // returned to the model (kept small)
  artifacts?: Omit<RunArtifact, "id" | "createdAt">[];
  workspaceWrites?: Record<string, string>;
};

export type AgentTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema for the arguments
  sideEffect: boolean;                 // true → run pauses for human approval before execution
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
};
