import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { resolveSaaSContext } from "@/lib/saas-runtime";
import { rankModelObservations, selectModel, type ModelObservation } from "@/lib/model-selection-learning";

function tenant(runtime: Awaited<ReturnType<typeof resolveSaaSContext>>) {
  return runtime.identity?.tenantId ?? runtime.legacyTenant?.tenantId;
}

export async function POST(request: Request) {
  const guard=guardMutation(request,"intelligence-model-selection");
  if (guard) return guard;
  const rl=rateLimit("intelligence-model-selection:"+((request.headers.get("x-forwarded-for")||"unknown").split(",")[0]));
  if (!rl.allowed) return NextResponse.json({ok:false,error:"RATE_LIMITED"},{status:429});
  try {
    const runtime=await resolveSaaSContext(request);
    const tenantId=tenant(runtime);
    if (!tenantId) return NextResponse.json({ok:false,error:"AUTH_REQUIRED"},{status:401});
    const body=await request.json() as Record<string,unknown>;
    const observations=Array.isArray(body.observations) ? body.observations.filter((x): x is ModelObservation => !!x && typeof x==="object" && typeof (x as Record<string,unknown>).modelKey==="string" && typeof (x as Record<string,unknown>).taskClass==="string" && typeof (x as Record<string,unknown>).outcomeQuality==="string" && ["VERIFIED","NEGATIVE","UNVERIFIED"].includes(String((x as Record<string,unknown>).outcomeQuality))).slice(0,200) : [];
    const ranked=rankModelObservations(observations);
    const selected=typeof body.taskClass==="string" ? selectModel(ranked,body.taskClass) : null;
    return NextResponse.json({ok:true,tenantScoped:true,ranked,selected,executionPolicy:"RECOMMENDATION_ONLY"});
  } catch(error) {
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"MODEL_SELECTION_FAILED"},{status:400});
  }
}
