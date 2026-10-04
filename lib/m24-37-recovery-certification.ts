import { createHash } from "node:crypto";
import type { RecoveryTerminalControlResult } from "@/lib/m24-36-terminal-control-plane";

export type RecoveryCertificationInput = {
  tenantId: string;
  recoveryKey: string;
  idempotencyKey: string;
  terminal: RecoveryTerminalControlResult;
  verifiedAt: string;
};

export type RecoveryCertificationResult = {
  certified: boolean;
  certificationHash: string | null;
  state: "CERTIFIED" | "BLOCKED";
  failures: string[];
};

export function hashRecoveryCertification(input: RecoveryCertificationInput): string {
  return createHash("sha256")
    .update(JSON.stringify({
      tenantId: input.tenantId,
      recoveryKey: input.recoveryKey,
      idempotencyKey: input.idempotencyKey,
      terminal: input.terminal,
      verifiedAt: input.verifiedAt,
    }))
    .digest("hex");
}

export function certifyRecoveryClosure(input: RecoveryCertificationInput): RecoveryCertificationResult {
  const failures = [...input.terminal.failures];

  if (!input.tenantId) failures.push("TENANT_ID_MISSING");
  if (!input.recoveryKey) failures.push("RECOVERY_KEY_MISSING");
  if (!input.idempotencyKey) failures.push("IDEMPOTENCY_KEY_MISSING");
  if (!input.verifiedAt) failures.push("VERIFICATION_TIMESTAMP_MISSING");
  if (!input.terminal.terminal || input.terminal.state !== "CLOSED") {
    failures.push("TERMINAL_CLOSE_NOT_CONFIRMED");
  }

  const uniqueFailures = [...new Set(failures)];
  const certified = uniqueFailures.length === 0;

  return {
    certified,
    certificationHash: certified ? hashRecoveryCertification(input) : null,
    state: certified ? "CERTIFIED" : "BLOCKED",
    failures: uniqueFailures,
  };
}
