import { NextResponse } from "next/server";
import { POST as agentPOST } from "@/app/api/agent/route";

const CLIENTS = new Set(["bet-builder","website-builder","trading-agent","offer-generator","job-agent","wrozbita-ai","fcc-crm","gastro-growth-os"]);
function clientAllowed(request:Request){const client=request.headers.get("x-core-engine-client")?.trim().toLowerCase();return client && CLIENTS.has(client)?client:null;}
export async function POST(request:Request){
  const client=clientAllowed(request);
  if(!client)return NextResponse.json({ok:false,error:"CORE_ENGINE_CLIENT_NOT_ALLOWED"}, {status:403});
  const raw=await request.text();
  if(new TextEncoder().encode(raw).byteLength>8*1024*1024)return NextResponse.json({ok:false,error:"REQUEST_TOO_LARGE"},{status:413});
  let body:Record<string,unknown>;
  try{body=raw?JSON.parse(raw):{};}catch{return NextResponse.json({ok:false,error:"INVALID_JSON"},{status:400});}
  const task=typeof body.task==="string"?body.task.trim():"";
  if(!task)return NextResponse.json({ok:false,error:"TASK_REQUIRED"},{status:400});
  const normalized={...body,task,project:client,approvalPolicy:body.approvalPolicy||"HUMAN_APPROVAL_REQUIRED",sideEffects:"BLOCKED_UNTIL_APPROVED"};
  const upstream=new Request(request.url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(normalized)});
  const response=await agentPOST(upstream);
  const payload=await response.json();
  return NextResponse.json({...payload,integration:{client,contract:"core-engine-agent-v1",centralRouter:true}}, {status:response.status});
}
export async function GET(){return NextResponse.json({ok:true,contract:"core-engine-agent-v1",clients:[...CLIENTS],approvalPolicy:"HUMAN_APPROVAL_REQUIRED",sideEffects:"BLOCKED_UNTIL_APPROVED"});}