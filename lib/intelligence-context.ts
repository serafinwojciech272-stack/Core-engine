export type IntelligenceContextItem={id?:string;title?:string;content?:string;confidence?:number|null;relevance?:number;source?:string|null;status?:string};
export type IntelligenceContext={
  version:"M10.5";
  advisoryOnly:true;
  claims:Array<Record<string,unknown>>;
  memories:IntelligenceContextItem[];
  unknowns:Array<Record<string,unknown>>;
  contradictions:Array<Record<string,unknown>>;
  learning:Array<Record<string,unknown>>;
  completeness:number;
  confidence:number;
  decisionConstraints:{criticalUnknowns:number;openContradictions:number;staleOrLowConfidenceClaims:number};
};
function clamp(n:number){return Math.max(0,Math.min(1,n));}
function rankConfidence(value:unknown){return typeof value==="number"&&Number.isFinite(value)?value:.5;}
function bounded<T>(items:T[],limit:number){return items.slice(0,limit);}
export function buildIntelligenceContext(input:{memories:Record<string,unknown>[];claims:Record<string,unknown>[];unknowns:Record<string,unknown>[];contradictions:Record<string,unknown>[];learning:Record<string,unknown>[]}):IntelligenceContext{
  const claims=[...input.claims].sort((a,b)=>rankConfidence(b.confidence)-rankConfidence(a.confidence));
  const memories=[...input.memories].sort((a,b)=>Number(b.relevance??0)-Number(a.relevance??0)||rankConfidence(b.confidence)-rankConfidence(a.confidence));
  const unknowns=[...input.unknowns].sort((a,b)=>String(b.importance??"LOW").localeCompare(String(a.importance??"LOW")));
  const contradictions=[...input.contradictions];
  const selectedClaims=bounded(claims,12);
  const selectedMemories=bounded(memories,8).map(x=>({id:typeof x.id==="string"?x.id:undefined,title:typeof x.title==="string"?x.title:undefined,content:typeof x.content==="string"?x.content.slice(0,2000):undefined,confidence:typeof x.confidence==="number"?x.confidence:null,relevance:typeof x.relevance==="number"?x.relevance:undefined,source:typeof x.source==="string"?x.source:null,status:typeof x.status==="string"?x.status:undefined}));
  const selectedUnknowns=bounded(unknowns,8);
  const selectedContradictions=bounded(contradictions,8);
  const selectedLearning=bounded(input.learning,6);
  const confidencePool=[...selectedClaims.map(x=>rankConfidence(x.confidence)),...selectedMemories.map(x=>rankConfidence(x.confidence))];
  const confidence=confidencePool.length?clamp(confidencePool.reduce((a,b)=>a+b,0)/confidencePool.length):0;
  const knownSignals=selectedClaims.length+selectedMemories.length+selectedLearning.length;
  const unresolved=selectedUnknowns.length+selectedContradictions.length;
  const completeness=clamp(knownSignals/(knownSignals+unresolved+1));
  return{version:"M10.5",advisoryOnly:true,claims:selectedClaims,memories:selectedMemories,unknowns:selectedUnknowns,contradictions:selectedContradictions,learning:selectedLearning,completeness,confidence,decisionConstraints:{criticalUnknowns:selectedUnknowns.filter(x=>String(x.importance)==="CRITICAL"&&String(x.status??"OPEN")!=="RESOLVED").length,openContradictions:selectedContradictions.filter(x=>String(x.status??"OPEN")==="OPEN").length,staleOrLowConfidenceClaims:selectedClaims.filter(x=>String(x.status)==="STALE"||rankConfidence(x.confidence)<.5).length}};
}