import {
  reconstructRecoveryState,
  createSupabaseRecoveryStateReconstructor,
  type RecoveryStateReconstructionPort,
  type ReconstructedRecoveryState,
} from "@/lib/recovery-state-reconstruction";

export async function recoverBrokerState(
  tenantId: string,
  brokerKey: string,
  reconstruction: RecoveryStateReconstructionPort = createSupabaseRecoveryStateReconstructor(),
): Promise<ReconstructedRecoveryState | null> {
  return reconstructRecoveryState(tenantId, brokerKey, reconstruction);
}
