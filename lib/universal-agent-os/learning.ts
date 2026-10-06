export type Evaluation={sampleId:string;skillId:string;quality:number;verified:boolean;latencyMs:number;cost:number;label?:number};
export type LearningPolicy={minSamples:number;regressionDelta:number;promotionQuality:number;canaryRate:number};
export function qualityScore(e:Evaluation[]){if(!e.length)return 0;return e.reduce((s,x)=>s+x.quality,0)/e.length}
export function verifiedRate(e:Evaluation[]){return e.length?e.filter(x=>x.verified).length/e.length:0}
export function regression(baseline:Evaluation[],candidate:Evaluation[],delta:number){return qualityScore(candidate)<qualityScore(baseline)-delta}
export function shouldPromote(e:Evaluation[],p:LearningPolicy){return e.length>=p.minSamples&&qualityScore(e)>=p.promotionQuality&&verifiedRate(e)>=p.promotionQuality}
export function canary(total:number,p:LearningPolicy){return Math.max(1,Math.ceil(total*p.canaryRate))}
export function confidence(e:Evaluation[]){if(!e.length)return 0;const q=qualityScore(e);return Math.min(1,q*Math.min(1,e.length/20))}
export function drift(a:Evaluation[],b:Evaluation[]){return Math.abs(qualityScore(a)-qualityScore(b))}
export function reward(e:Evaluation){return e.quality-(e.cost/100)-(e.latencyMs/10000)}
export function rankEvaluations(e:Evaluation[]){return [...e].sort((a,b)=>reward(b)-reward(a))}