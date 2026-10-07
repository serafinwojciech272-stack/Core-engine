import { NextResponse } from "next/server";
import { recordIntelligenceEvidence } from "@/lib/intelligence-evidence";
export async function POST(request:Request){try{const body=await request.json();if(!body?.requestId||!body?.task)return NextResponse.json({ok:false,error:"REQUEST_ID_AND_TASK_REQUIRED"},{status:400});const result=await recordIntelligenceEvidence(body);return NextResponse.json({ok:true,...result});}catch{return NextResponse.json({ok:false,error:"INTELLIGENCE_EVIDENCE_FAILED"},{status:400});}}
export async function GET(){return NextResponse.json({ok:true,service:"core-engine-intelligence-evidence",version:"M-AI-10",storage:"Supabase ce_intelligence_audit_events + ce_intelligence_learning_events"});}
