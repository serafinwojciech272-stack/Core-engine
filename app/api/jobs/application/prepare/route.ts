import { NextResponse } from "next/server";
import { prepareApplication } from "@/lib/application-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body?.url || !String(body.url).startsWith("http")) {
      return NextResponse.json({ ok: false, error: "INVALID_JOB_URL" }, { status: 400 });
    }
    const application = prepareApplication({
      title: String(body.title || "Selected position"),
      company: body.company ? String(body.company) : null,
      location: body.location ? String(body.location) : null,
      description: body.description ? String(body.description) : null,
      url: String(body.url),
      matchScore: typeof body.matchScore === "number" ? body.matchScore : null,
      decision: body.decision ? String(body.decision) : null
    });
    return NextResponse.json({ ok: true, application });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
