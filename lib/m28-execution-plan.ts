import type { DecisionAction } from "@/lib/m26-decision-actions";
export type ExecutionPlan={id:string;decisionHash:string;actions:DecisionAction[];mode:"OBSERVATIONAL"|"EXECUTABLE";requiresHumanApproval:true;rollback:string[]};
export function buildExecutionPlan(decisionHash:string,actions:DecisionAction[],mode:"OBSERVATIONAL"|"EXECUTABLE"="OBSERVATIONAL"):ExecutionPlan{return {id:`PLAN-${decisionHash.slice(0,12)}`,decisionHash,actions,mode,requiresHumanApproval:true,rollback:["STOP","REVERT_IF_SUPPORTED","RECONCILE_OUTCOME"]};}
