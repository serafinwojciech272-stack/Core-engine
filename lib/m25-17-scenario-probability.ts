import type { ScenarioSet } from "@/lib/m25-05-scenario-engine";
export type ScenarioWeighting="UNWEIGHTED"|"EVIDENCE_WEIGHTED"|"CALIBRATED";
export type WeightedScenarioSet=ScenarioSet&{weighting:ScenarioWeighting;probabilityQuality:"NONE"|"HEURISTIC"|"CALIBRATED";probabilityRationale:string[]};
export function weightScenarios(set:ScenarioSet,input:{evidenceStrength:number;calibrationReady:boolean}):WeightedScenarioSet{
 if(input.calibrationReady&&set.scenarios.length){const raw=set.scenarios.map((_,i)=>i===0?Math.max(.01,input.evidenceStrength):1),total=raw.reduce((a,b)=>a+b,0);return {...set,scenarios:set.scenarios.map((s,i)=>({...s,probability:Math.round(raw[i]/total*10000)/10000})),weighting:"CALIBRATED",probabilityQuality:"CALIBRATED",probabilityRationale:["Historical calibration available"]};}
 return {...set,weighting:"UNWEIGHTED",probabilityQuality:"NONE",probabilityRationale:["No calibrated probability model supplied"]};
}
