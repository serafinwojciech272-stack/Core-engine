import { guardMutation } from "@/lib/http";
import { NextResponse } from "next/server";
import { verifyResult } from "@/lib/result-verification";
export async function POST(request:Request){
  { const guard = guardMutation(request, "verify-result"); if (guard) return guard; }
 let body:Record<string,unknown>;try{body=await request.json();}catch{return NextResponse.json({ok:false,error:"INVALID_JSON"},{status:400});}
 const task=typeof body.task==="string"?body.task:"";const result=typeof body.result==="string"?body.result:"";
 if(!task||!result)return NextResponse.json({ok:false,error:"TASK_AND_RESULT_REQUIRED"},{status:400});
 return NextResponse.json({ok:true,verification:verifyResult(task,result,{toolExecuted:body.toolExecuted===true,artifactCreated:body.artifactCreated===true,approvalRequired:body.approvalRequired!==false})});
}