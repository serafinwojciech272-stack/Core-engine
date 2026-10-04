import { createHash } from "node:crypto";

export type RecoveryControlAudit = { auditId: string; recoveryKey: string; state: "OPEN" | "CLOSE_READY" | "CLOSED"; decision: "CLOSE" | "KEEP_OPEN"; terminal: boolean; closureHash: string; createdAt: string };

export function createRecoveryControlAudit(input: Omit<RecoveryControlAudit, "auditId">): RecoveryControlAudit {
  const auditId = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return { auditId, ...input };
}
