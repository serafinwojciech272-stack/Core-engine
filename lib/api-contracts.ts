import type { Decision, Mission } from "@/lib/engine";
import type { DecisionContract, MissionContract, Signal, Context, Evidence, Diagnosis } from "@/lib/core-contracts";

export type TraceStep = { stage:string; status:string; evidence?:string[]; output?:string };
export type AuditPayload = { algorithm:string; integrity:string; chainLength:number; head?:string; chain:unknown[] };
export type EngineResponse = { ok:boolean; engine:string; version:string; state?:string; persistence?:string; durable?:boolean; decision?:Decision; learning?:{applied:number;lessons:unknown[]}; mission?:Mission; trace?:TraceStep[]; audit?:AuditPayload; error?:string; blocked?:boolean };
export type MissionActionResponse = { ok:boolean; mission?:Mission; action?:string; assessment?:unknown; learning?:unknown; event?:unknown; trace?:TraceStep[]; duplicate?:boolean; persistence?:string; error?:string };

export type { DecisionContract, MissionContract, Signal, Context, Evidence, Diagnosis };
