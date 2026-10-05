import { evaluateRecoveryCertificationChainIntegrity,type RecoveryCertificationChainIntegrityDecision } from "@/lib/m24-42-chain-integrity-decision";
import type { RecoveryCertificationChainReplayResult } from "@/lib/m24-40-certification-chain-replay";
export type M25M24ExecutionDecision={ready:boolean;m24:RecoveryCertificationChainIntegrityDecision;failures:string[]};
export function handoffToM24(input:{tenantId:string;recoveryKey:string;idempotencyKey:string;replay:RecoveryCertificationChainReplayResult}):M25M24ExecutionDecision{const m24=evaluateRecoveryCertificationChainIntegrity(input);return {ready:m24.valid&&m24.executionPermission==="GRANTED",m24,failures:m24.failures};}
