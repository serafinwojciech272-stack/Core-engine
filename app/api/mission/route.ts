import { NextResponse } from "next/server";
import { missions, events, recordMissionEvent, transitionMission, type MissionState } from "@/lib/engine";
import { listPersistedEvents, listPersistedMissions, storageMode, transitionPersistedMission } from "@/lib/storage";

const MAX_BODY_BYTES = 16_000;

export async function GET() {
  if (storageMode() === "supabase") {
    try {
      const [persistedMissions, persistedEvents] = await Promise.all([
        listPersistedMissions(),
        listPersistedEvents()
      ]);
      return NextResponse.json({
        ok: true,
        missions: persistedMissions,
        count: persistedMissions.length,
        persistence: "supabase",
        events: persistedEvents
      });
    } catch {
      return NextResponse.json({ ok: false, error: "PERSISTENCE_READ_FAILED" }, { status: 503 });
    }
  }

  return NextResponse.json({
    ok: true,
    missions: Array.from(missions.values()),
    count: missions.size,
    persistence: "in-memory-runtime",
    events: events.slice(-100).reverse()
  });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413 });
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  const action = typeof payload.action === "string" ? payload.action : "";

  if (!id) return NextResponse.json({ ok: false, error: "MISSION_ID_REQUIRED" }, { status: 400 });
  if (!action) return NextResponse.json({ ok: false, error: "ACTION_REQUIRED" }, { status: 400 });

  const nextByAction: Record<string, MissionState> = {
    approve: "APPROVED",
    reject: "REJECTED",
    execute: "EXECUTING",
    measure: "MEASURING",
    complete: "COMPLETED",
    learn: "LEARNED"
  };
  const next = nextByAction[action];
  if (!next) return NextResponse.json({ ok: false, error: "UNKNOWN_ACTION" }, { status: 400 });

  if (storageMode() === "supabase") {
    try {
      const persisted = (await listPersistedMissions()).find((item) => item.id === id);
      if (!persisted) return NextResponse.json({ ok: false, error: "MISSION_NOT_FOUND" }, { status: 404 });

      const actorType = action === "approve" || action === "reject" ? "human" : "system";
      const result = await transitionPersistedMission(id, next, actorType);
      const updated = {
        ...persisted,
        state: result.to_state,
        executionCount: result.execution_count,
        updatedAt: new Date().toISOString()
      };
      return NextResponse.json({ ok: true, mission: updated, action, persistence: "supabase" });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      const status = detail.includes("MISSION_NOT_FOUND") ? 404 : detail.includes("INVALID_TRANSITION") ? 409 : 503;
      return NextResponse.json({
        ok: false,
        error: status === 409 ? "INVALID_TRANSITION" : status === 404 ? "MISSION_NOT_FOUND" : "PERSISTENCE_WRITE_FAILED"
      }, { status });
    }
  }

  const mission = missions.get(id);
  if (!mission) return NextResponse.json({ ok: false, error: "MISSION_NOT_FOUND" }, { status: 404 });

  try {
    const updated = transitionMission(mission, next);
    updated.executionCount = action === "execute" ? mission.executionCount + 1 : mission.executionCount;
    missions.set(id, updated);
    const event = recordMissionEvent({
      missionId: id,
      decisionId: updated.decisionId,
      eventType: "STATE_CHANGED",
      fromState: mission.state,
      toState: updated.state,
      actorType: action === "approve" || action === "reject" ? "human" : "system"
    });
    return NextResponse.json({ ok: true, mission: updated, action, event, persistence: "in-memory-runtime" });
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_TRANSITION" }, { status: 409 });
  }
}
