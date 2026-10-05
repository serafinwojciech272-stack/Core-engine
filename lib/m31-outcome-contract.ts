import { canonicalHash } from "@/lib/m25-11-canonical-hash";
export type OutcomeEvent={requestId:string;decisionHash:string;expected:string;actual:string;status:"MATCH"|"MISS";observedAt:string;outcomeHash:string};
export function createOutcomeEvent(input:Omit<OutcomeEvent,"status"|"outcomeHash">):OutcomeEvent{const status:"MATCH"|"MISS"=input.actual.trim().toLowerCase()===input.expected.trim().toLowerCase()?"MATCH":"MISS";const base={...input,status};return {...base,outcomeHash:canonicalHash(base)};}
