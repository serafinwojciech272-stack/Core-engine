export type EvaluationMetric={name:string;value:number;threshold:number;passed:boolean};
export type EvaluationCase={caseId:string;input:unknown;expected?:unknown;tags:string[]};
export type EvaluationRun={runId:string;definitionId:string;version:string;mode:"OFFLINE"|"REGRESSION"|"SHADOW"|"AB";status:"RUNNING"|"PASSED"|"FAILED";metrics:EvaluationMetric[];sampleSize:number};
export type EvaluationSignal={runId:string;target:string;reason:string;metrics:EvaluationMetric[];eligibleForProposal:boolean};

export class AIEvaluationGovernance {
  private runs=new Map<string,EvaluationRun>();
  start(run:EvaluationRun){if(run.sampleSize<0)throw new Error("INVALID_SAMPLE");this.runs.set(run.runId,{...run});return {...run};}
  complete(runId:string,metrics:EvaluationMetric[]){const r=this.runs.get(runId);if(!r)throw new Error("EVALUATION_NOT_FOUND");const passed=metrics.every(m=>m.passed);r.metrics=metrics;r.status=passed?"PASSED":"FAILED";return {...r};}
  signal(runId:string,target:string){
    const r=this.runs.get(runId);if(!r)throw new Error("EVALUATION_NOT_FOUND");
    const eligible=r.status==="PASSED"&&r.sampleSize>0;
    return {runId,target,reason:eligible?"evaluation passed":"evaluation did not establish promotion evidence",metrics:r.metrics,eligibleForProposal:eligible};
  }
  assertNoDirectDeployment(signal:EvaluationSignal){if(signal.eligibleForProposal&&signal.target.startsWith("PROD_DIRECT"))throw new Error("EVALUATION_CANNOT_DEPLOY");return true;}
  snapshot(){return [...this.runs.values()];}
}
