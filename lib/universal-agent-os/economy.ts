export type SkillEconomy={skillId:string;cost:number;latencyMs:number;successRate:number;demand:number;capacity:number;trust:number;certified:boolean};
export function roi(x:SkillEconomy,value:number){return x.cost>0?(value-x.cost)/x.cost:value>0?Infinity:0}
export function trustScore(x:SkillEconomy){return Math.max(0,Math.min(1,(x.trust+x.successRate+(x.certified?1:0))/3))}
export function allocation(x:SkillEconomy,budget:number){if(x.cost<=0)return x.capacity;return Math.min(x.capacity,Math.floor(budget/x.cost))}
export function priority(x:SkillEconomy){return (x.successRate*x.trustScore(x)*Math.max(1,x.demand))/(Math.max(1,x.cost)*Math.max(1,x.latencyMs))}
export function optimizePortfolio(items:SkillEconomy[],budget:number){let remaining=budget;return [...items].sort((a,b)=>priority(b)-priority(a)).map(x=>{const units=allocation(x,remaining);remaining-=units*x.cost;return {skillId:x.skillId,units}}).filter(x=>x.units>0)}
export function quotaUsed(units:number,quota:number){return quota<=0?1:Math.min(1,units/quota)}
export function capacityGap(x:SkillEconomy){return Math.max(0,x.demand-x.capacity)}
export function certificationRequired(x:SkillEconomy){return x.trust<.8||x.successRate<.8||!x.certified}
export function deprecate(x:SkillEconomy){return x.successRate<.5&&x.demand<1}
export function migrationNeeded(current:string,target:string){return current!==target}