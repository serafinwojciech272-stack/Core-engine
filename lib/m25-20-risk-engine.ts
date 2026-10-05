export type RiskLevel="LOW"|"MEDIUM"|"HIGH"|"CRITICAL";
export type RiskItem={id:string;description:string;probability:number;impact:number;mitigation:string;invalidation:string};
export type RiskAssessment={items:RiskItem[];aggregate:number;level:RiskLevel;failClosed:boolean};
export function assessRisks(items:readonly RiskItem[]):RiskAssessment{const normalized=items.map(r=>({...r,probability:Math.max(0,Math.min(1,r.probability)),impact:Math.max(0,Math.min(1,r.impact))}));const aggregate=normalized.length?Math.max(...normalized.map(r=>r.probability*r.impact)):0;const level:RiskLevel=aggregate>=.75?"CRITICAL":aggregate>=.5?"HIGH":aggregate>=.25?"MEDIUM":"LOW";return {items:normalized,aggregate,level,failClosed:level==="CRITICAL"||normalized.some(r=>!r.mitigation||!r.invalidation)};}
