import test from "node:test";
import assert from "node:assert/strict";
import {
  persistRecoveryCertification,
  replayRecoveryCertification,
  type PersistedRecoveryCertification,
  type RecoveryCertificationStore,
} from "@/lib/m24-38-certification-persistence";
import type { RecoveryCertificationInput } from "@/lib/m24-37-recovery-certification";

class MemoryCertificationStore implements RecoveryCertificationStore {
  private record: PersistedRecoveryCertification | null = null;

  async put(record: PersistedRecoveryCertification): Promise<PersistedRecoveryCertification> {
    if (this.record) {
      return this.record;
    }
    this.record = structuredClone(record);
    return structuredClone(this.record);
  }

  async get(): Promise<PersistedRecoveryCertification | null> {
    return this.record ? structuredClone(this.record) : null;
  }

  tamper(mutator: (record: PersistedRecoveryCertification) => void): void {
    if (!this.record) throw new Error("missing record");
    mutator(this.record);
  }
}

const certification: RecoveryCertificationInput = {
  tenantId: "00000000-0000-0000-0000-000000000001",
  recoveryKey: "recovery-1",
  idempotencyKey: "idem-1",
  terminal: {
    transitionAllowed: true,
    terminal: true,
    state: "CLOSED",
    failures: [],
  },
  verifiedAt: "2026-10-04T00:00:00.000Z",
};

test("M24.38 persists a certified closure", async () => {
  const store = new MemoryCertificationStore();
  const result = await persistRecoveryCertification(store, certification);

  assert.equal(result.persisted, true);
  assert.equal(result.idempotentReplay, true);
  assert.equal(result.state, "CERTIFIED");
  assert.equal(result.certificationHash?.length, 64);
  assert.deepEqual(result.failures, []);
});

test("M24.38 replays a persisted certification without changing its hash", async () => {
  const store = new MemoryCertificationStore();
  await persistRecoveryCertification(store, certification);

  const result = await replayRecoveryCertification(store, {
    tenantId: certification.tenantId,
    recoveryKey: certification.recoveryKey,
    idempotencyKey: certification.idempotencyKey,
  });

  assert.equal(result.replayValid, true);
  assert.equal(result.state, "CERTIFIED");
  assert.equal(result.certificationHash?.length, 64);
  assert.deepEqual(result.failures, []);
});

test("M24.38 blocks replay after certification payload tampering", async () => {
  const store = new MemoryCertificationStore();
  await persistRecoveryCertification(store, certification);
  store.tamper((record) => {
    record.certification.terminal.state = "BLOCKED";
  });

  const result = await replayRecoveryCertification(store, {
    tenantId: certification.tenantId,
    recoveryKey: certification.recoveryKey,
    idempotencyKey: certification.idempotencyKey,
  });

  assert.equal(result.replayValid, false);
  assert.equal(result.state, "BLOCKED");
  assert.equal(result.certificationHash, null);
  assert.deepEqual(result.failures, [
    "CERTIFICATION_NO_LONGER_VALID",
    "CERTIFICATION_HASH_MISMATCH",
  ]);
});

test("M24.38 blocks replay after stored hash tampering", async () => {
  const store = new MemoryCertificationStore();
  await persistRecoveryCertification(store, certification);
  store.tamper((record) => {
    record.certificationHash = "0".repeat(64);
  });

  const result = await replayRecoveryCertification(store, {
    tenantId: certification.tenantId,
    recoveryKey: certification.recoveryKey,
    idempotencyKey: certification.idempotencyKey,
  });

  assert.equal(result.replayValid, false);
  assert.equal(result.state, "BLOCKED");
  assert.deepEqual(result.failures, ["CERTIFICATION_HASH_MISMATCH"]);
});

test("M24.38 is idempotent for the same certification identity", async () => {
  const store = new MemoryCertificationStore();
  const first = await persistRecoveryCertification(store, certification);
  const second = await persistRecoveryCertification(store, certification);

  assert.equal(first.persisted, true);
  assert.equal(second.persisted, true);
  assert.equal(second.idempotentReplay, true);
  assert.equal(second.certificationHash, first.certificationHash);
});

test("M24.38 blocks replay when certification is absent", async () => {
  const store = new MemoryCertificationStore();

  const result = await replayRecoveryCertification(store, {
    tenantId: certification.tenantId,
    recoveryKey: certification.recoveryKey,
    idempotencyKey: certification.idempotencyKey,
  });

  assert.equal(result.replayValid, false);
  assert.equal(result.state, "BLOCKED");
  assert.equal(result.certificationHash, null);
  assert.deepEqual(result.failures, ["CERTIFICATION_NOT_FOUND"]);
});

test("M24.38 rejects non-certified terminal state before persistence", async () => {
  const store = new MemoryCertificationStore();
  const blocked = {
    ...certification,
    terminal: {
      ...certification.terminal,
      terminal: false,
      state: "BLOCKED" as const,
      transitionAllowed: false,
      failures: ["EVIDENCE_NOT_VERIFIED"],
    },
  };

  const result = await persistRecoveryCertification(store, blocked);

  assert.equal(result.persisted, false);
  assert.equal(result.state, "BLOCKED");
  assert.equal(result.certificationHash, null);
  assert.deepEqual(result.failures, ["EVIDENCE_NOT_VERIFIED"]);
});
