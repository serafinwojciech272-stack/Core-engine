export type RecoveryTerminalState = "OPEN" | "CLOSE_READY" | "CLOSED";

export type RecoveryTerminalTransition = { from: RecoveryTerminalState; to: RecoveryTerminalState; allowed: boolean; reason: string };

export function transitionRecoveryTerminalState(from: RecoveryTerminalState, requested: RecoveryTerminalState): RecoveryTerminalTransition {
  if (from === "CLOSED") return { from, to: from, allowed: requested === "CLOSED", reason: requested === "CLOSED" ? "TERMINAL_STATE_IMMUTABLE" : "TERMINAL_STATE_CANNOT_REOPEN" };
  if (requested === "CLOSED") return { from, to: from, allowed: false, reason: "CLOSE_REQUIRES_M24_38_DECISION" };
  if (from === requested) return { from, to: requested, allowed: true, reason: "NO_STATE_CHANGE" };
  if (from === "OPEN" && requested === "CLOSE_READY") return { from, to: requested, allowed: true, reason: "CLOSURE_PREREQUISITES_PENDING_FINALIZATION" };
  if (from === "CLOSE_READY" && requested === "OPEN") return { from, to: requested, allowed: true, reason: "CLOSURE_REOPENED_BEFORE_TERMINAL_COMMIT" };
  return { from, to: from, allowed: false, reason: "INVALID_TERMINAL_TRANSITION" };
}
