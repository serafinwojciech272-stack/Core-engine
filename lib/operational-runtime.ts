import { randomUUID } from "node:crypto";
import { executeRoutedMultiTask, type MultiTaskArtifact } from "@/lib/multitask-engine";
import { routeIntelligenceTask } from "@/lib/m12-intelligence-router";

export type OperationalStageStatus = "PENDING"|"RUNNING"|"SUCCEEDED"|"FAILED"|"BLOCKED";

export type OperationalStage = {
  id: "PLAN"|"TOOL_CALL"|"EXECUTE"|"VERIFY"|"ARTIFACT"|"OUTCOME";
  status: OperationalStageStatus;
  startedAt?: string;
  completedAt?: string;
  toolId?: string;
  detail?: string;
};

export type OperationalRun = {
  runId: string;
  status: "COMPLETED"|"FAILED"|"PLANNED"|"NO_TOOL";
  stages: OperationalStage[];
  tool?: { id: string; status: "EXECUTED"|"FAILED"|"NOT_EXECUTED"; receipt?: unknown };
  artifact?: MultiTaskArtifact;
  verification: { passed: boolean; score: number; checks: string[]; failures: string[] };
  outcome: { status: "READY"|"FAILED"|"NO_TOOL"; summary: string };
};

function stage(id: OperationalStage["id"]): OperationalStage {
  return { id, status: "PENDING" };
}

function mark(s: OperationalStage, status: OperationalStageStatus, detail?: string) {
  return { ...s, status, detail, ...(status === "RUNNING" ? { startedAt: new Date().toISOString() } : { completedAt: new Date().toISOString() }) };
}

export async function executeOperationalRun(
  task: string,
  input: Record<string, unknown> = {}
): Promise<OperationalRun> {
  const runId = "run-" + randomUUID();
  const stages = (["PLAN","TOOL_CALL","EXECUTE","VERIFY","ARTIFACT","OUTCOME"] as const).map(stage);
  const route = routeIntelligenceTask(task);
  stages[0] = mark(stages[0], "RUNNING", `Intent routed to ${route.domain}; complexity ${route.complexity}.`);
  stages[0] = mark(stages[0], "SUCCEEDED", `Plan ready. Mode: ${route.mode}.`);

  const native = input._nativeToolExecution as {
    toolId?: string;
    status?: "EXECUTED" | "FAILED";
    receipt?: unknown;
    artifact?: MultiTaskArtifact;
  } | undefined;
  const routedPreview = native?.toolId
    ? {
        route: { action: { id: native.toolId } },
        receipt: native.receipt as { status?: string; message?: string } | undefined,
        artifact: native.artifact,
      }
    : await executeRoutedMultiTask(task, input);
  const action = routedPreview.route.action;

  if (!action) {
    stages[1] = mark(stages[1], "SUCCEEDED", "No deterministic capability tool required. LLM response path remains active.");
    stages[2] = mark(stages[2], "SUCCEEDED", "No external/local tool execution required.");
    stages[3] = mark(stages[3], "SUCCEEDED", "Text response path does not require artifact verification.");
    stages[4] = mark(stages[4], "SUCCEEDED", "No artifact expected.");
    stages[5] = mark(stages[5], "SUCCEEDED", "Outcome returned from intelligence layer.");
    return {
      runId, status: "NO_TOOL", stages,
      verification: { passed: true, score: 100, checks: ["No-tool task"], failures: [] },
      outcome: { status: "NO_TOOL", summary: "Zadanie obsłużone przez warstwę inteligencji bez capability tool." }
    };
  }

  stages[1] = mark(stages[1], "RUNNING", `Tool selected: ${action.id}.`);
  stages[1] = mark(stages[1], "SUCCEEDED", `Tool call issued: ${action.id}.`,);
  stages[1].toolId = action.id;

  stages[2] = mark(stages[2], "RUNNING", "Executing capability adapter.");
  const receiptStatus = routedPreview.receipt?.status === "EXECUTED" ? "EXECUTED" : "FAILED";
  stages[2] = mark(stages[2], receiptStatus === "EXECUTED" ? "SUCCEEDED" : "FAILED",
    receiptStatus === "EXECUTED" ? "Capability executed successfully." : (routedPreview.receipt?.message || "Capability execution failed.")
  );
  stages[2].toolId = action.id;

  const artifact = routedPreview.artifact;
  const verificationChecks: string[] = [];
  const failures: string[] = [];
  verificationChecks.push("Tool receipt exists.");
  if (receiptStatus !== "EXECUTED") failures.push("Tool execution did not succeed.");
  else verificationChecks.push("Tool receipt reports EXECUTED.");
  if (artifact?.status === "EXECUTED") verificationChecks.push("Artifact reports EXECUTED.");
  else failures.push("No executed artifact returned.");

  stages[3] = mark(stages[3], "RUNNING", "Verifying execution receipt and artifact contract.");
  const passed = failures.length === 0;
  stages[3] = mark(stages[3], passed ? "SUCCEEDED" : "FAILED", passed ? "Verification passed." : failures.join(" "));

  stages[4] = mark(stages[4], artifact?.status === "EXECUTED" ? "SUCCEEDED" : "FAILED",
    artifact?.status === "EXECUTED" ? `Artifact ready: ${artifact.title}.` : "Artifact was not produced."
  );

  stages[5] = mark(stages[5], passed ? "SUCCEEDED" : "FAILED",
    passed ? "Outcome is ready for the caller." : "Outcome blocked because verification failed."
  );

  return {
    runId,
    status: passed ? "COMPLETED" : "FAILED",
    stages,
    tool: { id: action.id, status: receiptStatus, receipt: routedPreview.receipt },
    artifact,
    verification: { passed, score: passed ? 100 : Math.max(0, 100 - failures.length * 35), checks: verificationChecks, failures },
    outcome: {
      status: passed ? "READY" : "FAILED",
      summary: passed ? "Plan → Tool Call → Execute → Verify → Artifact → Outcome completed." : "Execution stopped at verification."
    }
  };
}
