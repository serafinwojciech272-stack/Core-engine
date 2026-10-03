import {
  reconstructRecoveryState,
  createSupabaseRecoveryStateReconstructor,
  type RecoveryStateReconstructionPort,
  type ReconstructedRecoveryState,
} from "@/lib/recovery-state-reconstruction";

export type RecoveryDecision = "NO_ACTION" | "RESUME" | "REPLAY" | "RECONCILE";

export type RecoveryCheck = {
  name: "CHECKPOINT" | "STATE" | "LEARNING" | "CONSISTENCY";
  passed: boolean;
  reason: string;
};

export type RecoveryDecisionResult = {
  tenantId: string;
  recoveryKey: string;
  commitId: string;
  payloadHash: string;
  decision: RecoveryDecision;
  reasons: string[];
  checks: RecoveryCheck[];
  requiresApproval: boolean;
  evaluatedAt: string;
  source: "RECOVERY_STATE";
};

function result(
  state: ReconstructedRecoveryState,
  decision: RecoveryDecision,
  reasons: string[],
  checks: RecoveryCheck[],
  requiresApproval: boolean,
): RecoveryDecisionResult {
  return {
    tenantId: state.tenantId,
    recoveryKey: state.recoveryKey,
    commitId: state.commitId,
    payloadHash: state.payloadHash,
    decision,
    reasons,
    checks,
    requiresApproval,
    evaluatedAt: new Date().toISOString(),
    source: "RECOVERY_STATE",
  };
}

function flag(state: Record<string, unknown>, key: string): boolean {
  return state[key] === true;
}

export function evaluateRecoveryDecision(
  state: ReconstructedRecoveryState,
): RecoveryDecisionResult {
  const checkpoint = state.checkpoint;
  const rawState = checkpoint.state ?? {};
  const learning = state.learning;

  const checkpointValid = Boolean(checkpoint.streamKey) && Boolean(checkpoint.cursor);
  const stateValid = typeof rawState === "object" && rawState !== null;
  const learningValid =
    learning === null ||
    (Boolean(learning.lessonType) &&
      Boolean(learning.quality) &&
      Boolean(learning.lesson) &&
      Boolean(learning.reason));
  const consistencyValid =
    checkpoint.streamKey === state.recoveryKey &&
    checkpointValid &&
    stateValid &&
    learningValid;

  const checks: RecoveryCheck[] = [
    {
      name: "CHECKPOINT",
      passed: checkpointValid,
      reason: checkpointValid
        ? "checkpoint contains streamKey and cursor"
        : "checkpoint is missing streamKey or cursor",
    },
    {
      name: "STATE",
      passed: stateValid,
      reason: stateValid
        ? "checkpoint state is structurally valid"
        : "checkpoint state is invalid",
    },
    {
      name: "LEARNING",
      passed: learningValid,
      reason: learningValid
        ? "learning evidence is valid or absent"
        : "learning evidence is incomplete",
    },
    {
      name: "CONSISTENCY",
      passed: consistencyValid,
      reason: consistencyValid
        ? "recovery key, stream key and evidence are consistent"
        : "recovery state contains an internal consistency conflict",
    },
  ];

  if (!consistencyValid) {
    return result(
      state,
      "RECONCILE",
      ["Recovery evidence is inconsistent or incomplete."],
      checks,
      true,
    );
  }

  if (learning?.quality === "NEGATIVE" || learning?.quality === "UNVERIFIED") {
    return result(
      state,
      "RECONCILE",
      [`Learning quality is ${learning.quality}; automated continuation is not justified.`],
      checks,
      true,
    );
  }

  if (flag(rawState, "replayRequired")) {
    return result(state, "REPLAY", ["Checkpoint explicitly requires replay."], checks, true);
  }

  if (flag(rawState, "paused") && flag(rawState, "resumable")) {
    return result(
      state,
      "RESUME",
      ["Checkpoint is paused and explicitly marked resumable."],
      checks,
      true,
    );
  }

  if (flag(rawState, "reconciled") && learning?.quality === "VERIFIED") {
    return result(
      state,
      "NO_ACTION",
      ["Checkpoint is reconciled and recovery learning is verified."],
      checks,
      false,
    );
  }

  return result(
    state,
    "RECONCILE",
    ["State is valid but has no safe explicit action signal."],
    checks,
    true,
  );
}

export type RecoveryDecisionEnginePort = {
  decide(tenantId: string, recoveryKey: string): Promise<RecoveryDecisionResult | null>;
};

export class RecoveryDecisionEngine implements RecoveryDecisionEnginePort {
  constructor(private readonly reconstruction: RecoveryStateReconstructionPort) {}

  async decide(
    tenantId: string,
    recoveryKey: string,
  ): Promise<RecoveryDecisionResult | null> {
    const state = await reconstructRecoveryState(
      tenantId,
      recoveryKey,
      this.reconstruction,
    );
    return state ? evaluateRecoveryDecision(state) : null;
  }
}

export function createSupabaseRecoveryDecisionEngine(): RecoveryDecisionEnginePort {
  return new RecoveryDecisionEngine(createSupabaseRecoveryStateReconstructor());
}

export async function decideRecovery(
  tenantId: string,
  recoveryKey: string,
  engine: RecoveryDecisionEnginePort = createSupabaseRecoveryDecisionEngine(),
): Promise<RecoveryDecisionResult | null> {
  if (!tenantId || !recoveryKey) {
    throw new Error("RECOVERY_DECISION_QUERY_INVALID");
  }
  return engine.decide(tenantId, recoveryKey);
}
