import type { EngineSignal } from "@/lib/engine";

export type FeatureSnapshot={status:"DERIVED"|"UNAVAILABLE";source:"SIGNALS"|"UNAVAILABLE";features:Record<string,number|null>;quality:"VALID"|"PARTIAL"|"UNAVAILABLE";methodology:"deterministic-feature-v1"};

const num=(signals:EngineSignal[],names:string[])=>{for(const n of names){const s=signals.find(x=>x.name===n);if(s){const v=Number.parseFloat(s.value.replace("%","").replace(",","."));if(Number.isFinite(v))return v;}}return null};

export function extractFeatures(signals:EngineSignal[]):FeatureSnapshot{
 const momentum=num(signals,["momentum_pct","momentum"]);
 const change=num(signals,["change_pct","change"]);
 const volatility=num(signals,["volatility_pct","volatility"]);
 const spread=num(signals,["spread_pct","spread"]);
 const features={momentumPct:momentum,changePct:change,volatilityPct:volatility,spreadPct:spread,absMomentum:momentum===null?null:Math.abs(momentum),volatilityToMomentum:momentum&&volatility!==null?Number((volatility/Math.max(Math.abs(momentum),0.001)).toFixed(3)):null};
 const count=Object.values(features).filter(v=>v!==null).length;
 return {status:count?"DERIVED":"UNAVAILABLE",source:count?"SIGNALS":"UNAVAILABLE",features,quality:count>=3?"VALID":count?"PARTIAL":"UNAVAILABLE",methodology:"deterministic-feature-v1"};
}