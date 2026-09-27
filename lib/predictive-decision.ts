import type { EngineSignal } from "@/lib/engine";

export type PredictiveHorizon = "24H" | "7D" | "30D" | "90D";
export type PredictiveOutcome = "IMPROVE" | "STABLE" | "DETERIORATE" | "UNCERTAIN";
export type PredictiveRisk = "LOW" | "MEDIUM" | "HIGH";

export type PredictiveScenario = {
  name: "BASE" | "UPSIDE" | "DOWNSIDE";
  probability: number;
  expectedImpactPct: number | null;
  outcome: PredictiveOutcome;
};

export type PredictiveDecision = {
  version: "m9.6-predictive-v1";
  horizon: PredictiveHorizon;
  outcome: PredictiveOutcome;
  expectedImpactPct: number | null;
  confidence: number;
  risk: PredictiveRisk;
  leadingIndicators: string[];
  failureModes: string[];
  trigger: string;
  invalidation: string;
  scenarios: PredictiveScenario[];
  source: "DETERMINISTIC_PREDICTIVE";
  truthModel: "DERIVED" | "ESTIMATED";
};

const clamp = (v:number,lo=0,hi=1) => Math.min(hi,Math.max(lo,v));
const pct = (value:string) => { const n=Number.parseFloat(value.replace("%","").replace(",",".")); return Number.isFinite(n)?n:null; };
const dir = (name:string,value:string) => {
  const n=name.toLowerCase(), v=pct(value);
  if (n.includes("drop")||n.includes("churn")||n.includes("error")||n.includes("loss")||n.includes("backlog")) return "negative";
  if (n.includes("conversion")||n.includes("revenue")||n.includes("traffic")||n.includes("qualified")||n.includes("margin")) return v!==null&&v<0?"negative":"positive";
  return "neutral";
};

export function buildPredictiveDecision(input:{
  signals:EngineSignal[];
  confidence:number;
  recommendation:string;
  domain?:string;
  learningCount?:number;
}):PredictiveDecision {
  const dirs=input.signals.map(s=>dir(s.name,s.value));
  const negative=dirs.filter(x=>x==="negative").length;
  const positive=dirs.filter(x=>x==="positive").length;
  const net=positive-negative;
  const coverage=clamp(input.signals.length/10);
  const learningBoost=clamp((input.learningCount??0)*0.015,0,0.08);
  const confidence=Number(clamp(input.confidence*0.75+coverage*0.15+learningBoost).toFixed(3));
  let outcome:PredictiveOutcome="UNCERTAIN";
  if(net>=2) outcome="IMPROVE"; else if(net<=-2) outcome="DETERIORATE"; else if(net===0) outcome="STABLE";
  const risk:PredictiveRisk=confidence>=0.78&&negative<=positive?"LOW":confidence>=0.58?"MEDIUM":"HIGH";
  const expectedImpactPct=outcome==="IMPROVE"?Number(Math.min(25,2+confidence*12+positive*1.5).toFixed(2)):outcome==="DETERIORATE"?Number(-Math.min(25,2+(1-confidence)*10+negative*1.5).toFixed(2)):outcome==="STABLE"?0:null;
  const leadingIndicators=input.signals.slice(0,5).map(s=>s.name+"="+s.value);
  const failureModes=[...(negative?["negative leading indicators persist"]:[]),...(input.learningCount===0?["no verified historical learning signal"]:[]),...(input.confidence<0.6?["low decision confidence"]:[]),"input distribution changes materially"].slice(0,4);
  const trigger=outcome==="IMPROVE"?"Leading indicators remain aligned with the decision thesis across the next observation window.":outcome==="DETERIORATE"?"Negative indicators persist or worsen in the next observation window.":"At least two leading indicators move materially away from the current baseline.";
  const invalidation="Invalidate the forecast when a primary signal changes direction, evidence freshness expires, or the approved intervention changes scope.";
  const base=Number(clamp(0.55+confidence*0.2-Math.abs(net)*0.03,0.35,0.75).toFixed(3));
  const up=Number(clamp((outcome==="IMPROVE"?0.25:0.15)+confidence*0.08,0.08,0.35).toFixed(3));
  const down=Number((1-base-up).toFixed(3));
  return {
    version:"m9.6-predictive-v1",
    horizon:input.domain==="trading"?"24H":input.domain==="tender"?"30D":"7D",
    outcome, expectedImpactPct, confidence, risk, leadingIndicators, failureModes, trigger, invalidation,
    scenarios:[
      {name:"BASE",probability:base,expectedImpactPct,outcome},
      {name:"UPSIDE",probability:up,expectedImpactPct:expectedImpactPct===null?null:Number((expectedImpactPct*1.5).toFixed(2)),outcome:outcome==="DETERIORATE"?"STABLE":"IMPROVE"},
      {name:"DOWNSIDE",probability:down,expectedImpactPct:expectedImpactPct===null?null:Number((expectedImpactPct*0.5).toFixed(2)),outcome:outcome==="IMPROVE"?"STABLE":"DETERIORATE"}
    ],
    source:"DETERMINISTIC_PREDICTIVE",
    truthModel:expectedImpactPct===null?"DERIVED":"ESTIMATED"
  };
}
