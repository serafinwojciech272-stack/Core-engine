export type JobLearningProfile = {
  sampleSize:number;
  acceptedCount:number;
  rejectedCount:number;
  appliedCount:number;
  responseCount:number;
  interviewCount:number;
  offerCount:number;
  weights:Record<string,number>;
  calibration:Record<string,unknown>;
};

const scoreBucket=(score:number|null)=> {
  const n=Number(score??0);
  return n>=85?"85_100":n>=75?"75_84":n>=60?"60_74":"0_59";
};

export async function computeJobLearning(rows:Array<Record<string,unknown>>):Promise<JobLearningProfile>{
  const outcomes=rows.filter(r=>typeof r.outcome_type==="string");
  const counts=(type:string)=>outcomes.filter(r=>r.outcome_type===type).length;
  const positive=counts("RESPONSE")+counts("INTERVIEW")+counts("OFFER");
  const negative=counts("REJECTED")+counts("WITHDRAWN");
  const buckets=["85_100","75_84","60_74","0_59"];
  const weights:Record<string,number>={};
  const calibration:Record<string,unknown>={};
  for(const bucket of buckets){
    const subset=outcomes.filter(r=>scoreBucket(Number((r.metadata as Record<string,unknown>|null)?.match_score??null))===bucket);
    const good=subset.filter(r=>["RESPONSE","INTERVIEW","OFFER"].includes(String(r.outcome_type))).length;
    const bad=subset.filter(r=>["REJECTED","WITHDRAWN"].includes(String(r.outcome_type))).length;
    const rate=(good+bad)>0?good/(good+bad):null;
    calibration[bucket]={samples:subset.length,positive:good,negative:bad,positiveRate:rate};
    weights[bucket]=rate===null?1:Math.max(.7,Math.min(1.3,.85+rate*.45));
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
    calibration:{positiveOutcomes:positive,negativeOutcomes:negative,positiveRate:(positive+negative)>0?positive/(positive+negative):null}
  };
}