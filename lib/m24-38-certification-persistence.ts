import {
  certifyRecoveryClosure,
  hashRecoveryCertification,
  type RecoveryCertificationInput,
} from "@/lib/m24-37-recovery-certification";

export type PersistedRecoveryCertification = {
  tenantId: string;
  recoveryKey: string;
  idempotencyKey: string;
  certificationHash: string;
  certification: RecoveryCertificationInput;
  certifiedAt: string;
};

export interface RecoveryCertificationStore {
  put(record: PersistedRecoveryCertification): Promise<PersistedRecoveryCertification>;
  get(identity: Pick<PersistedRecoveryCertification, "tenantId" | "recoveryKey" | "idempotencyKey">): Promise<PersistedRecoveryCertification | null>;
}

export type CertificationPersistenceResult = {
  persisted: boolean;
  idempotentReplay: boolean;
  state: "CERTIFIED" | "BLOCKED";
  certificationHash: string | null;
  failures: string[];
};

export type CertificationReplayResult = {
  replayValid: boolean;
  state: "CERTIFIED" | "BLOCKED";
  certificationHash: string | null;
  failures: string[];
};

export async function persistRecoveryCertification(
  store: RecoveryCertificationStore,
  input: RecoveryCertificationInput,
): Promise<CertificationPersistenceResult> {
  const certification = certifyRecoveryClosure(input);

  if (!certification.certified || !certification.certificationHash) {
    return {
      persisted: false,
      idempotentReplay: false,
      state: "BLOCKED",
      certificationHash: null,
      failures: certification.failures,
    };
  }

  const record: PersistedRecoveryCertification = {
    tenantId: input.tenantId,
    recoveryKey: input.recoveryKey,
    idempotencyKey: input.idempotencyKey,
    certificationHash: certification.certificationHash,
    certification: input,
    certifiedAt: input.verifiedAt,
  };

  const stored = await store.put(record);
  const storedHash = hashRecoveryCertification(stored.certification);

  if (
    stored.tenantId !== input.tenantId ||
    stored.recoveryKey !== input.recoveryKey ||
    stored.idempotencyKey !== input.idempotencyKey ||
    stored.certificationHash !== storedHash
  ) {
    return {
      persisted: false,
      idempotentReplay: false,
      state: "BLOCKED",
      certificationHash: null,
      failures: ["CERTIFICATION_PERSISTENCE_INTEGRITY_FAILURE"],
    };
  }

  const idempotentReplay = stored.certificationHash === certification.certificationHash;

  return {
    persisted: true,
    idempotentReplay,
    state: "CERTIFIED",
    certificationHash: stored.certificationHash,
    failures: [],
  };
}

export async function replayRecoveryCertification(
  store: RecoveryCertificationStore,
  identity: Pick<PersistedRecoveryCertification, "tenantId" | "recoveryKey" | "idempotencyKey">,
): Promise<CertificationReplayResult> {
  const stored = await store.get(identity);

  if (!stored) {
    return {
      replayValid: false,
      state: "BLOCKED",
      certificationHash: null,
      failures: ["CERTIFICATION_NOT_FOUND"],
    };
  }

  const recomputedHash = hashRecoveryCertification(stored.certification);
  const identityMatches =
    stored.tenantId === stored.certification.tenantId &&
    stored.recoveryKey === stored.certification.recoveryKey &&
    stored.idempotencyKey === stored.certification.idempotencyKey &&
    stored.certifiedAt === stored.certification.verifiedAt;

  const certificationStillValid = certifyRecoveryClosure(stored.certification).certified;

  const failures: string[] = [];
  if (!identityMatches) failures.push("CERTIFICATION_IDENTITY_MISMATCH");
  if (!certificationStillValid) failures.push("CERTIFICATION_NO_LONGER_VALID");
  if (stored.certificationHash !== recomputedHash) failures.push("CERTIFICATION_HASH_MISMATCH");

  const uniqueFailures = [...new Set(failures)];

  return {
    replayValid: uniqueFailures.length === 0,
    state: uniqueFailures.length === 0 ? "CERTIFIED" : "BLOCKED",
    certificationHash: uniqueFailures.length === 0 ? recomputedHash : null,
    failures: uniqueFailures,
  };
}
