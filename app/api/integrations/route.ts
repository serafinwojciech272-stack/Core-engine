import { safeEqual } from "@/lib/http";
import { NextResponse } from "next/server";
import { POST as agentPOST } from "@/app/api/agent/route";

const CLIENTS = new Set(["bet-builder","website-builder","trading-agent","offer-generator","job-agent","wrozbita-ai","fcc-crm","gastro-growth-os"]);
const POLICIES:Record<string,{domain:string;sideEffects:string;approval:string;capabilities:string[]}>={
  "bet-builder":{domain:"sports-analysis",sideEffects:"OBSERVATIONAL_ONLY",approval:"HUMAN_APPROVAL_REQUIRED",capabilities:["reasoning","risk-analysis","verification"]},
  "website-builder":{domain:"web-build",sideEffects:"BLOCKED_UNTIL_APPROVED",approval:"HUMAN_APPROVAL_REQUIRED",capabilities:["website.build","content","verification"]},
  "trading-agent":{domain:"trading-analysis",sideEffects:"OBSERVATIONAL_ONLY",approval:"HUMAN_APPROVAL_REQUIRED",capabilities:["market-analysis","risk-analysis","verification"]},
  "offer-generator":{domain:"commercial-offer",sideEffects:"BLOCKED_UNTIL_APPROVED",approval:"HUMAN_APPROVAL_REQUIRED",capabilities:["offer-generation","documents","verification"]},
  "job-agent":{domain:"job-search",sideEffects:"BLOCKED_UNTIL_APPROVED",approval:"REVIEW_BEFORE_SUBMIT",capabilities:["research","matching","verification"]},
  "wrozbita-ai":{domain:"creative-conversation",sideEffects:"BLOCKED_UNTIL_APPROVED",approval:"HUMAN_APPROVAL_REQUIRED",capabilities:["creative","reasoning","conversation"]},
  "fcc-crm":{domain:"crm-operations",sideEffects:"BLOCKED_UNTIL_APPROVED",approval:"HUMAN_APPROVAL_REQUIRED",capabilities:["crm","data","verification"]},
  "gastro-growth-os":{domain:"business-operations",sideEffects:"BLOCKED_UNTIL_APPROVED",approval:"HUMAN_APPROVAL_REQUIRED",capabilities:["strategy","operations","verification"]}
};
// Each client authenticates with its own secret (CORE_ENGINE_INTEGRATION_KEYS_JSON = {"bet-builder":"<secret>",...}).
// The client name alone is public (see GET) and is never sufficient.
function clientAllowed(request:Request){
  const client=request.headers.get("x-core-engine-client")?.trim().toLowerCase();
  if(!client||!CLIENTS.has(client))return null;
  let keys:Record<string,unknown>={};
  try{keys=JSON.parse(process.env.CORE_ENGINE_INTEGRATION_KEYS_JSON||"{}");}catch{return null;}
  const secret=keys[client];
  const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"";
  return typeof secret==="string"&&secret&&token&&safeEqual(token,secret)?client:null;
}
export async function POST(request:Request){
  const client=clientAllowed(request);
  if(!client)return NextResponse.json({ok:false,error:"CORE_ENGINE_CLIENT_NOT_ALLOWED"}, {status:403});
  const raw=await request.text();
  if(new TextEncoder().encode(raw).byteLength>8*1024*1024)return NextResponse.json({ok:false,error:"REQUEST_TOO_LARGE"},{status:413});
  let body:Record<string,unknown>;
  try{body=raw?JSON.parse(raw):{};}catch{return NextResponse.json({ok:false,error:"INVALID_JSON"},{status:400});}
  const task=typeof body.task==="string"?body.task.trim():"";
  if(!task)return NextResponse.json({ok:false,error:"TASK_REQUIRED"},{status:400});
  const policy=POLICIES[client]; const normalized={...body,task,project:client,domain:policy.domain,capabilities:body.capabilities||policy.capabilities,approvalPolicy:body.approvalPolicy||policy.approval,sideEffects:policy.sideEffects};
  const upstream=new Request(request.url,{method:"POST",headers:{"content-type":"application/json",...(process.env.CORE_ENGINE_API_KEY?{authorization:"Bearer "+process.env.CORE_ENGINE_API_KEY}:{})},body:JSON.stringify(normalized)});
  const response=await agentPOST(upstream);
  const payload=await response.json();
  return NextResponse.json({...payload,integration:{client,contract:"core-engine-agent-v1",centralRouter:true,policy:POLICIES[client]}}, {status:response.status});
}
export async function GET(){return NextResponse.json({ok:true,contract:"core-engine-agent-v1",version:"M-AI-09",clients:[...CLIENTS],policies:POLICIES,centralRouter:true});}