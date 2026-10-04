import type { RecoveryTerminalClosureInput, RecoveryTerminalClosureResult } from "@/lib/m24-37-terminal-recovery-closure";
import { evaluateTerminalRecoveryClosure } from "@/lib/m24-37-terminal-recovery-closure";

export type RecoveryClosureDecision = {
  decision: "CLOSE" | "KEEP_OPEN";
  terminal: boolean;
  reason: string;
  closure: RecoveryTerminalClosureResult;
};

export function decideRecoveryClosure(input: RecoveryTerminalClosureInput): RecoveryClosureDecision {
  const closure = evaluateTerminalRecoveryClosure(input);
  return { decision: closure.terminal ? "CLOSE" : "KEEP_OPEN", terminal: closure.terminal, reason: closure.terminal ? "ALL_TERMINAL_PREREQUISITES_SATISFIED" : closure.failures.join(","), closure };
}
