import { NextResponse } from "next/server";
import { getPersistedTenderCase, storageMode } from "@/lib/storage";
export const runtime="nodejs";
export async function GET(request:Request){
 const caseId=new URL(request.url).searchParams.get("caseId")||"Z154/68879";
 try{
  if(storageMode()!=="supabase")return NextResponse.json({ok:false,error:"DURABLE_STORAGE_NOT_CONFIGURED"},{status:503});
  const row=await getPersistedTenderCase(caseId);
  if(!row)return NextResponse.json({ok:false,error:"TENDER_CASE_NOT_FOUND"},{status:404});
  return NextResponse.json({ok:true,caseId,row,persistence:"supabase",durable:true});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"TENDER_CASE_READ_FAILED"},{status:503})}
}