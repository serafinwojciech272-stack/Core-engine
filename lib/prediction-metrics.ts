import type { PredictionLedgerEntry } from "@/lib/storage";
export type PredictionMetrics={sampleSize:number;resolved:number;winRate:number|null;meanExpectedR:number|null;meanRealizedR:number|null;brierP1R:number|null;calibrationStatus:"UNCALIBRATED"|"OBSERVATIONAL";source:"DERIVED"};
export function calculatePredictionMetrics(rows:PredictionLedgerEntry[]):PredictionMetrics{
 const resolved=rows.filter(x=>x.outcomeStatus==="WON"||x.outcomeStatus==="LOST"); const n=resolved.length;
 const mean=(v:number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:null;
 return {sampleSize:rows.length,resolved:n,winRate:n?resolved.filter(x=>x.outcomeStatus==="WON").length/n:null,meanExpectedR:mean(resolved.map(x=>x.expectedR).filter((x):x is number=>x!==null)),meanRealizedR:mean(resolved.map(x=>x.realizedR).filter((x):x is number=>x!==null)),brierP1R:n?mean(resolved.map(x=>(x.p1R-(x.outcomeStatus==="WON"?1:0))**2)):null,calibrationStatus:n>=100?"OBSERVATIONAL":"UNCALIBRATED",source:"DERIVED"};
}