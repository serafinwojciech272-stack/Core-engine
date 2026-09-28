import { buildDecision } from "@/lib/ai-decision";
import { extractJobFeatures, scoreBucket } from "@/lib/job-learning";
import { validateJobOpportunity } from "@/lib/job-quality";

export type JobOpportunity = {
  source:string; url:string; title:string; company:string|null; location:string|null;
  salary:string|null; description:string|null; publishedAt:string|null; raw:Record<string,unknown>;
};

const queries = [
  "Business Development Manager",
  "Operations Manager",
  "Customer Experience Manager",
  "Customer Service Manager",
  "Sales Manager",
  "Account Manager",
  "Key Account Manager",
  "Export Manager Commercial Manager",
  "German speaking manager customer service",
  "Process Manager Team Leader Supervisor",
  "Customer Service Specialist German English",
  "Order Management German English"
];

const local = "(Gliwice OR Zabrze OR Bytom OR \"Ruda Śląska\" OR \"Tarnowskie Góry\" OR Knurów OR Pyskowice OR Chorzów)";
const sources = [
  ["pracuj.pl","pracuj.pl"],["indeed","indeed.com"],["olx","olx.pl"],["linkedin","linkedin.com/jobs"],
  ["nofluffjobs","nofluffjobs.com"],["justjoin.it","justjoin.it"],["rocketjobs","rocketjobs.pl"],
  ["pracapolis","pracapolis.pl"],["adzuna","adzuna.pl"],["jooble","jooble.org"],["jobs.pl","jobs.pl"]
] as const;

function text(x:unknown){ return typeof x==="string" ? x.trim() : ""; }
function find(value:string, terms:string[]){ const low=value.toLowerCase(); return terms.find(x=>low.includes(x.toLowerCase())) || null; }

function sourceFor(url:string){
  const low=url.toLowerCase();
  return sources.find(x=>low.includes(x[1]))?.[0] || null;
}

function normalize(r:Record<string,unknown>, source:string):JobOpportunity|null{
  const url=text(r.link), title=text(r.title), snippet=text(r.snippet);
  if(!url || !title || !source) return null;

  const hay=title+" "+snippet;

  const location=find(hay,["Gliwice","Zabrze","Bytom","Ruda Śląska","Tarnowskie Góry","Knurów","Pyskowice","Chorzów"]) ||
    (/cała polska|poland|remote|zdalna/i.test(hay) ? "Polska / zdalnie" : null);
  const quality=validateJobOpportunity({source,url,title,company:null,location,description:snippet||null});
  if(!quality.valid) return null;

  const salary=find(hay,["PLN","zł","brutto","gross","EUR","€"]);
  const parts=title.split(/\s[-–—|]\s/);
  const company=parts.length>1 ? parts[parts.length-1].trim() : null;

  return {
    source,url,title,company,location,salary,
    description:snippet||null,
    publishedAt:text(r.date)||text(r.datePublished)||null,
    raw:r
  };
}

async function search(q:string){
  const key=process.env.SERPER_API_KEY;
  if(!key) throw new Error("SERPER_API_KEY_MISSING");
  const endpoint=process.env.JOB_SEARCH_API_URL || "https://google.serper.dev/search";
  const r=await fetch(endpoint,{
    method:"POST",
    headers:{"X-API-KEY":key,"Content-Type":"application/json"},
    body:JSON.stringify({q,gl:"pl",hl:"pl",num:10}),
    cache:"no-store",
    signal:AbortSignal.timeout(12000)
  });
  if(!r.ok) throw new Error("JOB_SEARCH_"+r.status);
  const data=await r.json() as {organic?:Record<string,unknown>[]};
  return data.organic || [];
}

export async function discoverJobs(){
  const errors:string[]=[];
  const out:JobOpportunity[]=[];
  const settled=await Promise.allSettled(
    queries.map(role=>search(`(${role}) ${local} (praca OR job OR zatrudnienie) -oferty -wyniki -search`))
  );

  settled.forEach((result,index)=>{
    if(result.status==="rejected"){
      errors.push(queries[index]+":"+String(result.reason));
      return;
    }
    for(const row of result.value){
      const link=text(row.link);
      const source=sourceFor(link);
      if(!source) continue;
      const job=normalize(row,source);
      if(job) out.push(job);
    }
  });

  const dedupe=new Map<string,JobOpportunity>();
  for(const job of out){
    const key=job.url.split("#")[0].replace(/\/$/,"").toLowerCase();
    dedupe.set(key,job);
  }

  return {
    jobs:[...dedupe.values()].slice(0,250),
    errors
  };
}

export async function scoreJobs(
  jobs:JobOpportunity[],
  learningWeights:Record<string,number>={},
  featureWeights:Record<string,number>={},
  interactionWeights:Record<string,number>={}
){
  const policy=await buildDecision([
    {name:"target_roles",value:queries.join(";"),source:"job_agent_policy"},
    {name:"location_radius",value:"Gliwice/Zabrze + 30 km",source:"job_agent_policy"},
    {name:"german_level",value:"B2+",source:"candidate_profile"},
    {name:"english_level",value:"B2+",source:"candidate_profile"},
    {name:"management_experience",value:"yes",source:"candidate_profile"},
    {name:"driving_license",value:"none",source:"candidate_constraint"}
  ],"jobs",[]);

  const roleTerms=[
    "business development","operations","customer experience","customer service","sales",
    "account manager","key account","export manager","commercial","process manager",
    "team leader","supervisor","customer service specialist","order management"
  ];

  const scored=jobs.map(j=>{
    const hay=(j.title+" "+(j.description||"")+" "+(j.location||"")).toLowerCase();
    let score=35;
    score+=Math.min(30,roleTerms.filter(x=>hay.includes(x)).length*7);
    if(/german|deutsch|niemiecki/.test(hay)) score+=15;
    if(/english|angielski/.test(hay)) score+=7;
    if(/manager|lead|supervisor|kierownik|koordynator|senior/.test(hay)) score+=6;
    if(hay.includes("gliwice")) score+=10;
    else if(/zabrze|bytom|ruda śląska|knurów|tarnowskie góry|pyskowice|chorzów/.test(hay)) score+=7;
    if(/remote|zdalna|cała polska/.test(hay)) score+=4;
    if(/driving licence|driving license|prawo jazdy/.test(hay)) score-=10;
    if(/własny samochód|samochód służbowy|mobile sales|praca mobilna/.test(hay)) score-=8;

    const deterministic=Math.max(0,Math.min(100,score));
    const features=extractJobFeatures({...j,match_score:deterministic});
    const bucketWeight=learningWeights[scoreBucket(deterministic)]??1;
    const keys=Object.entries(features).map(([k,v])=>k+"="+String(v));
    const featureAdjustment=Math.max(.75,Math.min(1.25,keys.reduce((p,k)=>p*(featureWeights[k]??1),1)));
    const pairs:string[]=[];
    for(let i=0;i<keys.length;i++) for(let z=i+1;z<keys.length;z++) pairs.push(keys[i]+" & "+keys[z]);
    const interactionProduct=pairs.reduce((p,k)=>p*(interactionWeights[k]??1),1);
    const interactionAdjustment=Math.max(.85,Math.min(1.15,interactionProduct));
    const calibrated=Math.max(0,Math.min(100,Math.round(
      deterministic*bucketWeight*featureAdjustment*interactionAdjustment
    )));
    const applied=bucketWeight!==1||featureAdjustment!==1||interactionAdjustment!==1;

    return {
      ...j,
      matchScore:calibrated,
      decision:calibrated>=75?"APPLY_CANDIDATE":calibrated>=60?"REVIEW":"REJECT",
      decisionReason:applied
        ? policy.recommendation+"; learning policy applied (bucket="+bucketWeight.toFixed(2)+", features="+featureAdjustment.toFixed(2)+", interactions="+interactionAdjustment.toFixed(2)+")"
        : policy.recommendation,
      applicationMode:"REVIEW_BEFORE_SUBMIT",
      learning:{
        policyVersion:"interaction-policy-v1",
        features,bucketWeight,featureAdjustment,interactionAdjustment
      }
    };
  });

  return {policy,scored};
}
