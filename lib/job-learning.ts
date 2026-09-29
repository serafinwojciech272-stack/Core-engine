export type JobLearningProfile = {
  sampleSize:number; acceptedCount:number; rejectedCount:number; appliedCount:number; responseCount:number; interviewCount:number; offerCount:number;
  weights:Record<string,number>; featureWeights:Record<string,number>; interactionWeights:Record<string,number>; calibration:Record<string,unknown>;
};
export type JobFeatureSnapshot = {roleFamily:string;hasGerman:boolean;hasEnglish:boolean;localMatch:boolean;remoteType:string;requiresDrivingLicense:boolean;salaryPresent:boolean;source:string;scoreBucket:string};
const POSITIVE=["RESPONSE","INTERVIEW","OFFER"],NEGATIVE=["REJECTED","WITHDRAWN"],buckets=["85_100","75_84","60_74","0_59"];
export function scoreBucket(score:number|null){const n=Number(score??0);return n>=85?"85_100":n>=75?"75_84":n>=60?"60_74":"0_59"}
function haystack(job:Record<string,unknown>){return [job.title,job.description,job.location,job.remote_type].filter(Boolean).join(" ").toLowerCase()}
export function extractJobFeatures(job:Record<string,unknown>):JobFeatureSnapshot{
 const hay=haystack(job);
 const role=hay.includes("business development")?"business_development":hay.includes("operations")?"operations":hay.includes("customer experience")?"customer_experience":hay.includes("customer service")?"customer_service":hay.includes("key account")?"key_account":hay.includes("account manager")?"account_management":hay.includes("export")?"export":hay.includes("sales")?"sales":hay.includes("commercial")?"commercial":hay.includes("process")?"process":hay.includes("team leader")||hay.includes("supervisor")?"leadership":"other";
 const remote=hay.includes("remote")||hay.includes("zdal")?"remote":hay.includes("hybrid")||hay.includes("hybryd")?"hybrid":"onsite";
 return {roleFamily:role,hasGerman:hay.includes("german")||hay.includes("deutsch")||hay.includes("niemiecki"),hasEnglish:hay.includes("english")||hay.includes("angielski"),localMatch:/gliwice|zabrze|bytom|ruda śląska|tarnowskie góry|knurów/i.test(hay),remoteType:remote,requiresDrivingLicense:hay.includes("driving licence")||hay.includes("driving license")||hay.includes("prawo jazdy"),salaryPresent:/\d[\d\s.,]*(?:pln|zł|eur|€|brutto|netto)/i.test(hay),source:String(job.source||"unknown"),scoreBucket:scoreBucket(Number(job.match_score??job.matchScore??0))};
}
function featureEntries(f:JobFeatureSnapshot){return Object.entries(f).map(([key,value])=>({key,value:String(value)}))}
export function featuresFromOutcome(row:Record<string,unknown>):JobFeatureSnapshot|null{const m=(row.metadata&&typeof row.metadata==="object"?row.metadata:{}) as Record<string,unknown>;const f=m.features;return f&&typeof f==="object"?f as JobFeatureSnapshot:null}

export async function computeJobLearning(rows:Array<Record<string,unknown>>):Promise<JobLearningProfile>{
 const outcomes=rows.filter(r=>typeof r.outcome_type==="string"),counts=(t:string)=>outcomes.filter(r=>r.outcome_type===t).length;
 const positive=counts("RESPONSE")+counts("INTERVIEW")+counts("OFFER"),negative=counts("REJECTED")+counts("WITHDRAWN"),weights:Record<string,number>={},calibration:Record<string,unknown>={};
 for(const bucket of buckets){const subset=outcomes.filter(r=>scoreBucket(Number((r.metadata as Record<string,unknown>|null)?.match_score??null))===bucket);const good=subset.filter(r=>POSITIVE.includes(String(r.outcome_type))).length,bad=subset.filter(r=>NEGATIVE.includes(String(r.outcome_type))).length,rate=good+bad>0?good/(good+bad):null;calibration[bucket]={samples:subset.length,positive:good,negative:bad,positiveRate:rate};weights[bucket]=rate===null?1:Math.max(.7,Math.min(1.3,.85+rate*.45))}
 const fs:Record<string,{positive:number;negative:number;samples:number;rate:number|null}>={},is:Record<string,{positive:number;negative:number;samples:number;rate:number|null}>={};
 for(const row of outcomes){const f=featuresFromOutcome(row);if(!f)continue;const p=POSITIVE.includes(String(row.outcome_type)),n=NEGATIVE.includes(String(row.outcome_type));if(!p&&!n)continue;const e=featureEntries(f);
  for(const x of e){const id=x.key+"="+x.value,s=fs[id]||{positive:0,negative:0,samples:0,rate:null};s.samples++;p?s.positive++:s.negative++;s.rate=s.positive/(s.positive+s.negative);fs[id]=s}
  for(let i=0;i<e.length;i++)for(let j=i+1;j<e.length;j++){const id=e[i].key+"="+e[i].value+" & "+e[j].key+"="+e[j].value,s=is[id]||{positive:0,negative:0,samples:0,rate:null};s.samples++;p?s.positive++:s.negative++;s.rate=s.positive/(s.positive+s.negative);is[id]=s}
 }
 const fw:Record<string,number>={},iw:Record<string,number>={},fc:Record<string,unknown>={},ic:Record<string,unknown>={},baseline=positive+negative>0?positive/(positive+negative):null;
 for(const [key,s] of Object.entries(fs)){if(s.samples<5||baseline===null){fw[key]=1;fc[key]={...s,confidence:0};continue}const confidence=Math.min(1,s.samples/25),raw=baseline>0?(s.rate??baseline)/baseline:1,bounded=Math.max(.85,Math.min(1.15,raw));fw[key]=Number((1+(bounded-1)*confidence).toFixed(4));fc[key]={...s,baseline,confidence,weight:fw[key]}}
 for(const [key,s] of Object.entries(is)){if(s.samples<8||baseline===null){iw[key]=1;ic[key]={...s,confidence:0};continue}const confidence=Math.min(1,s.samples/40),raw=baseline>0?(s.rate??baseline)/baseline:1,bounded=Math.max(.90,Math.min(1.10,raw));iw[key]=Number((1+(bounded-1)*confidence).toFixed(4));ic[key]={...s,baseline,confidence,weight:iw[key]}}
 return {sampleSize:outcomes.length,acceptedCount:counts("ACCEPTED"),rejectedCount:negative,appliedCount:counts("APPLIED"),responseCount:counts("RESPONSE"),interviewCount:counts("INTERVIEW"),offerCount:counts("OFFER"),weights,featureWeights:fw,interactionWeights:iw,calibration:{positiveOutcomes:positive,negativeOutcomes:negative,positiveRate:baseline,featureStats:fc,interactionStats:ic}}
}