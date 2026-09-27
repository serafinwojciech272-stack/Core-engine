import { buildDecision } from "@/lib/ai-decision";

export type JobOpportunity={source:string;url:string;title:string;company:string|null;location:string|null;salary:string|null;description:string|null;publishedAt:string|null;raw:Record<string,unknown>};
const sources=[["pracuj.pl","site:pracuj.pl/praca"],["indeed","site:pl.indeed.com"],["olx","site:olx.pl/praca"],["linkedin","site:linkedin.com/jobs/view"],["nofluffjobs","site:nofluffjobs.com/job"],["justjoin.it","site:justjoin.it/offers"],["rocketjobs","site:rocketjobs.pl"],["pracapolis","site:pracapolis.pl"],["adzuna","site:adzuna.pl"],["jooble","site:pl.jooble.org"]];

const queries=[
"Business Development Manager",
"Operations Manager",
"Customer Experience Manager",
"Sales Manager",
"Account Manager Key Account Manager",
"Export Manager Commercial Manager",
"German speaking manager customer service",
"process manager team leader supervisor"
];

function text(x:unknown){return typeof x==="string"?x:""}
function normalize(r:Record<string,unknown>,source:string):JobOpportunity|null{
 const url=text(r.link); const title=text(r.title); if(!url||!title)return null;
 const snippet=text(r.snippet);
 return {source,url,title,company:null,location:null,salary:null,description:snippet,publishedAt:null,raw:r};
}
async function search(q:string){
 const key=process.env.SERPER_API_KEY;
 const endpoint=process.env.JOB_SEARCH_API_URL||"https://google.serper.dev/search";
 if(!key)return [];
 const r=await fetch(endpoint,{method:"POST",headers:{"X-API-KEY":key,"Content-Type":"application/json"},body:JSON.stringify({q,gl:"pl",hl:"pl",num:10}),cache:"no-store",signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw new Error("JOB_SEARCH_"+r.status);
 const b=await r.json() as {organic?:Record<string,unknown>[]};
 return b.organic||[];
}

export async function discoverJobs(){
 const out:JobOpportunity[]=[]; const errors:string[]=[];
 const targets=sources.map(x=>x[1]+" ("+x[0]+")").join(" OR ");
 for(const role of queries){
   try{
    const rows=await search('('+role+') ("Gliwice" OR "Zabrze" OR "Bytom" OR "Ruda Śląska" OR "Tarnowskie Góry" OR "Knurów") '+targets);
    for(const row of rows){const source=sources.find(x=>text(row.link).includes(x[1].replace("site:","").split("/")[0]))?.[0]||"web";const j=normalize(row,source);if(j)out.push(j)}
   }catch(e){errors.push(role+":"+String(e))}
 }
 const dedupe=new Map<string,JobOpportunity>(); for(const j of out)dedupe.set(j.url,j);
 return {jobs:[...dedupe.values()],errors};
}

export async function scoreJobs(jobs:JobOpportunity[],learningWeights:Record<string,number>={}){
 const policy=await buildDecision([
  {name:"target_roles",value:queries.join(";"),source:"job_agent_policy"},
  {name:"location_radius",value:"Gliwice + 30 km",source:"job_agent_policy"},
  {name:"german_level",value:"B2+",source:"candidate_profile"},
  {name:"english_level",value:"B2+",source:"candidate_profile"},
  {name:"management_experience",value:"yes",source:"candidate_profile"},
  {name:"driving_license",value:"none",source:"candidate_constraint"}
 ],"jobs",[]);
 const roleTerms=["business development","operations","customer experience","sales","account manager","key account","export manager","commercial","process manager","team leader","supervisor","customer service"];
 const scored=jobs.map(j=>{
  const hay=(j.title+" "+(j.description||"")+" "+(j.location||"")).toLowerCase();
  let score=35;
  const roleHits=roleTerms.filter(x=>hay.includes(x)); score+=Math.min(30,roleHits.length*7);
  if(hay.includes("german")||hay.includes("deutsch"))score+=15;
  if(hay.includes("english")||hay.includes("angielski"))score+=7;
  if(hay.includes("gliwice"))score+=10;
  else if(hay.includes("zabrze")||hay.includes("bytom")||hay.includes("ruda śląska")||hay.includes("knurów")||hay.includes("tarnowskie góry"))score+=7;
  if(hay.includes("driving licence")||hay.includes("prawo jazdy"))score-=10;
  return {...j,matchScore:Math.max(0,Math.min(100,score)),decision:score>=75?"APPLY_CANDIDATE":score>=60?"REVIEW":"REJECT",decisionReason:policy.recommendation,applicationMode:score>=75?"REVIEW_BEFORE_SUBMIT":"REVIEW"};
 });
 return {policy,scored};
}
