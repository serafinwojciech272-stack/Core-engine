export type JobLearningProfile = {
  sampleSize:number;
  acceptedCount:number;
  rejectedCount:number;
  appliedCount:number;
  responseCount:number;
  interviewCount:number;
  offerCount:number;
  weights:Record<string,number>;
  featureWeights:Record<string,number>;
  calibration:Record<string,unknown>;
};

export type JobFeatureSnapshot = {
  roleFamily:string;
  hasGerman:boolean;
  hasEnglish:boolean;
  localMatch:boolean;
  remoteType:string;
  requiresDrivingLicense:boolean;
  salaryPresent:boolean;
  source:string;
  scoreBucket:string;
};

const POSITIVE=["RESPONSE","INTERVIEW","OFFER"];
const NEGATIVE=["REJECTED","WITHDRAWN"];
const buckets=["85_100","75_84","60_74","0_59"];

export function scoreBucket(score:number|null){
  const n=Number(score??0);
  return n>=85?"85_100":n>=75?"75_84":n>=60?"60_74":"0_59";
}

function haystack(job:Record<string,unknown>){
  return [job.title,job.description,job.location,job.remote_type].filter(Boolean).join(" ").toLowerCase();
}

export function extractJobFeatures(job:Record<string,unknown>):JobFeatureSnapshot{
  const hay=haystack(job);
  const role =
    hay.includes("business development")?"business_development":
    hay.includes("operations")?"operations":
    hay.includes("customer experience")?"customer_experience":
    hay.includes("customer service")?"customer_service":
    hay.includes("key account")?"key_account":
    hay.includes("account manager")?"account_management":
    hay.includes("export")?"export":
    hay.includes("sales")?"sales":
    hay.includes("commercial")?"commercial":
    hay.includes("process")?"process":
    hay.includes("team leader")||hay.includes("supervisor")?"leadership":"other";
  const remote=hay.includes("remote")||hay.includes("zdal")?"remote":hay.includes("hybrid")||hay.includes("hybryd")?"hybrid":"onsite";
  return {
    roleFamily:role,
    hasGerman:hay.includes("german")||hay.includes("deutsch")||hay.includes("niemiecki"),
    hasEnglish:hay.includes("english")||hay.includes("angielski"),
    localMatch:/gliwice|zabrze|bytom|ruda śląska|tarnowskie góry|knurów/i.test(hay),
    remoteType:remote,
    requiresDrivingLicense:hay.includes("driving licence")||hay.includes("driving license")||hay.includes("prawo jazdy"),
    salaryPresent:/\d[\d\s.,]*(?:pln|zł|eur|€|brutto|netto)/i.test(hay),
    source:String(job.source||"unknown"),
    scoreBucket:scoreBucket(Number(job.match_score??job.matchScore??0))
  };
}

function featureEntries(features:JobFeatureSnapshot){
  return Object.entries(features).map(([key,value])=>({key,value:String(value)}));
}

export function featuresFromOutcome(row:Record<string,unknown>):JobFeatureSnapshot|null{
  const metadata=(row.metadata&&typeof row.metadata==="object"?row.metadata:{}) as Record<string,unknown>;
  const f=metadata.features;
  if(!f||typeof f!=="object")return null;
  return f as JobFeatureSnapshot;
}

export async function computeJobLearning(rows:Array<Record<string,unknown>>):Promise<JobLearningProfile>{
  const outcomes=rows.filter(r=>typeof r.outcome_type==="string");
  const counts=(type:string)=>outcomes.filter(r=>r.outcome_type===type).length;
  const positive=counts("RESPONSE")+counts("INTERVIEW")+counts("OFFER");
  const negative=counts("REJECTED")+counts("WITHDRAWN");
  const weights:Record<string,number>={};
  const calibration:Record<string,unknown>={};

  for(const bucket of buckets){
    const subset=outcomes.filter(r=>scoreBucket(Number((r.metadata as Record<string,unknown>|null)?.match_score??null))===bucket);
    const good=subset.filter(r=>POSITIVE.includes(String(r.outcome_type))).length;
    const bad=subset.filter(r=>NEGATIVE.includes(String(r.outcome_type))).length;
    const rate=(good+bad)>0?good/(good+bad):null;
    calibration[bucket]={samples:subset.length,positive:good,negative:bad,positiveRate:rate};
    weights[bucket]=rate===null?1:Math.max(.7,Math.min(1.3,.85+rate*.45));
  }

  const featureStats:Record<string,{positive:number;negative:number;samples:number;rate:number|null}>={};
  for(const row of outcomes){
    const features=featuresFromOutcome(row);
    if(!features)continue;
    const isPos=POSITIVE.includes(String(row.outcome_type));
    const isNeg=NEGATIVE.includes(String(row.outcome_type));
    if(!isPos&&!isNeg)continue;
    for(const {key,value} of featureEntries(features)){
      const id=key+"="+value;
      const stat=featureStats[id]||{positive:0,negative:0,samples:0,rate:null};
      stat.samples++;
      if(isPos)stat.positive++; else stat.negative++;
      stat.rate=stat.positive/(stat.positive+stat.negative);
      featureStats[id]=stat;
    }
  }

  const featureWeights:Record<string,number>={};
  const featureCalibration:Record<string,unknown>={};
  const baseline=(positive+negative)>0?positive/(positive+negative):null;
  for(const [key,stat] of Object.entries(featureStats)){
    if(stat.samples<5||baseline===null){
      featureWeights[key]=1;
      featureCalibration[key]={...stat,confidence:0};
      continue;
    }
    const confidence=Math.min(1,stat.samples/25);
    const raw=baseline>0?(stat.rate??baseline)/baseline:1;
    const bounded=Math.max(.85,Math.min(1.15,raw));
    featureWeights[key]=Number((1+(bounded-1)*confidence).toFixed(4));
    featureCalibration[key]={...stat,baseline,confidence,weight:featureWeights[key]};
  }

  return {
    sampleSize:outcomes.length,
    acceptedCount:counts("ACCEPTED"),
    rejectedCount:negative,
    appliedCount:counts("APPLIED"),
    responseCount:counts("RESPONSE"),
    interviewCount:counts("INTERVIEW"),
    offerCount:counts("OFFER"),
    weights,
    featureWeights,
    calibration:{positiveOutcomes:positive,negativeOutcomes:negative,positiveRate:baseline,featureStats:featureCalibration}
  };
}
