export type ConfidenceBand="LOW"|"MEDIUM"|"HIGH";
export type ConfidenceResult={score:number;band:ConfidenceBand;uncertaintyRange:[number,number];reasons:string[]};
export function assessConfidence(input:{evidenceSufficient:boolean;domainCount:number;dataFresh:boolean;assumptionCount:number;conflicts?:number}):ConfidenceResult{
  let score=0.5,reasons:string[]=[];
  if(input.evidenceSufficient){score+=0.2}else{score-=0.3;reasons.push("INSUFFICIENT_EVIDENCE")}
  if(input.dataFresh){score+=0.1}else{score-=0.15;reasons.push("STALE_DATA")}
  if(input.domainCount>1){score-=0.05;reasons.push("MULTI_DOMAIN_COMPLEXITY")}
  if(input.assumptionCount>3){score-=0.1;reasons.push("MANY_ASSUMPTIONS")}
  if((input.conflicts??0)>0){score-=Math.min(0.25,(input.conflicts??0)*0.05);reasons.push("CONFLICTING_SIGNALS")}
  score=Math.max(0,Math.min(1,Math.round(score*100)/100));
  const spread=Math.round((1-score)*50);
  return {score,band:score>=0.75?"HIGH":score>=0.5?"MEDIUM":"LOW",uncertaintyRange:[Math.max(0,score-spread/100),Math.min(1,score+spread/100)],reasons};
}
