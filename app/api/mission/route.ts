import { NextResponse } from "next/server";
import { missions, transitionMission, type MissionState } from "@/lib/engine";

export async function GET() {
  return NextResponse.json({
    ok: true,
    missions: Array.from(missions.values()),
    count: missions.size,
    persistence: "in-memory-runtime"
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  const action = body.action as "approve" | "reject" | "execute" | "measure" | "complete" | "learn" | undefined;
  const mission = missions.get(id);

  if (!mission) return NextResponse.json({ok:false,error:"MISSION_NOT_FOUND"},{status:404});
  if (!action) return NextResponse.json({ok:false,error:"ACTION_REQUIRED"},{status:400});

  const nextByAction: Record<string, MissionState> = {
    approve:"APPROVED", reject:"REJECTED", execute:"EXECUTING",
    measure:"MEASURING", complete:"COMPLETED", learn:"LEARNED"
  };
  const next = nextByAction[action];
  try {
    const updated = transitionMission(mission, next);
    updated.executionCount = action === "execute" ? mission.executionCount + 1 : mission.executionCount;
    missions.set(id, updated);
    return NextResponse.json({ok:true, mission:updated, action});
  } catch (error) {
    return NextResponse.json({ok:false,error:"INVALID_TRANSITION",detail:error instanceof Error ? error.message : "Unknown error"},{status:409});
  }
}
