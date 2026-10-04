import {
  readRecovery,
  createSupabaseRecoveryRead,
  type RecoveryReadPort,
  type RecoveryReadResult,
} from "@/lib/recovery-read";

export type ReconstructedRecoveryState = {
  tenantId: string;
  recoveryKey: string;
  commitId: string;
  payloadHash: string;
  checkpoint: RecoveryReadResult["checkpoint"];
  learning: RecoveryReadResult["learning"];
  reconstructedAt: string;
  source: "RECOVERY_COMMIT";
};

export type RecoveryStateReconstructionPort = {
  reconstruct(
    tenantId: string,
    recoveryKey: string,
  ): Promise<ReconstructedRecoveryState | null>;
};

export class RecoveryStateReconstructor implements RecoveryStateReconstructionPort {
  private readonly readPort: RecoveryReadPort;

  constructor(readPort: RecoveryReadPort) {
    this.readPort = readPort;
  }

  async reconstruct(
    tenantId: string,
    recoveryKey: string,
  ): Promise<ReconstructedRecoveryState | null> {
    const record = await readRecovery(
      { tenantId, recoveryKey },
      this.readPort,
    );

    if (!record) return null;

    return {
      tenantId: record.tenantId,
      recoveryKey: record.recoveryKey,
      commitId: record.commitId,
      payloadHash: record.payloadHash,
      checkpoint: record.checkpoint,
      learning: record.learning,
      reconstructedAt: new Date().toISOString(),
      source: "RECOVERY_COMMIT",
    };
  }
}

export function createSupabaseRecoveryStateReconstructor(): RecoveryStateReconstructionPort {
  return new RecoveryStateReconstructor(createSupabaseRecoveryRead());
}

export async function reconstructRecoveryState(
  tenantId: string,
  recoveryKey: string,
  port: RecoveryStateReconstructionPort = createSupabaseRecoveryStateReconstructor(),
): Promise<ReconstructedRecoveryState | null> {
  if (!tenantId || !recoveryKey) {
    throw new Error("RECOVERY_RECONSTRUCTION_QUERY_INVALID");
  }

  return port.reconstruct(tenantId, recoveryKey);
}
