import { NextResponse } from "next/server";
import { candidateProfile } from "@/lib/candidate-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { jobId?: string; jobUrl?: string; title?: string; company?: string | null };
    if (!body.jobUrl || !/^https?:\\/\\//i.test(body.jobUrl)) {
      return NextResponse.json({ ok:false, error:"INVALID_JOB_URL" }, { status:400 });
    }

    const role = body.title || "Selected position";
    const company = body.company || "Target company";

    return NextResponse.json({
      ok:true,
      mode:"REVIEW_BEFORE_SUBMIT",
      approvalRequired:true,
      application:{
        jobId:body.jobId||null,
        jobUrl:body.jobUrl,
        role,
        company,
        candidate:{
          name:candidateProfile.name,
          headline:candidateProfile.headline,
          location:candidateProfile.location,
          languages:candidateProfile.languages,
          targetRoles:candidateProfile.targetRoles
        },
        cvRoute:"/cv",
        providerUrl:body.jobUrl
      },
      engine:{
        steps:[
          "PROFILE_MATCH",
          "JOB_REQUIREMENTS_CHECK",
          "CV_SELECTION",
          "APPLICATION_PREPARATION",
          "HUMAN_APPROVAL",
          "PROVIDER_SUBMISSION"
        ],
        automaticSubmission:false,
        reason:"External job boards use different application flows and terms. Core Engine prepares and gates the application; the final provider submission remains under human approval."
      }
    });
  } catch (error) {
    return NextResponse.json({ ok:false, error:String(error) }, { status:500 });
  }
}
