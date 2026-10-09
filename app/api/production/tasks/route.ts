import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { resolveSaaSContext } from "@/lib/saas-runtime";
import { createProductionTask, transitionProductionTask, type ProductionTaskRecord, type TaskTransitionInput } from "@/lib/production-task-harness";
import { createStoredProductionTask, getStoredProductionTask, updateStoredProductionTask } from "@/lib/production-task-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(code: string, status: number) {
  return NextResponse.json({ ok: false, error: code }, { status, headers: { "Cache-Control": "no-store" } });
}

async function tenantFor(request: Request) {
  authenticate(request, true);
  const context = await resolveSaaSContext(request);
  const tenantId = context.identity?.tenantId || context.legacyTenant?.tenantId;
  if (!tenantId) throw new Error("TENANT_CONTEXT_REQUIRED");
  return tenantId;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function POST(request: Request) {
  try {
    const tenantId = await tenantFor(request);
    if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
      return errorResponse("CONTENT_TYPE_JSON_REQUIRED", 415);
    }
    const idempotencyKey = (request.headers.get("idempotency-key") || "").trim();
    if (!idempotencyKey || idempotencyKey.length > 128) return errorResponse("IDEMPOTENCY_KEY_REQUIRED", 400);
    const body: unknown = await request.json();
    if (!isObject(body) || typeof body.title !== "string" || typeof body.objective !== "string" || !Array.isArray(body.acceptanceCriteria)) {
      return errorResponse("INVALID_TASK_INPUT", 400);
    }
    if (body.title.length > 200 || body.objective.length > 4000 || body.acceptanceCriteria.length > 30) {
      return errorResponse("TASK_INPUT_LIMIT_EXCEEDED", 413);
    }
    const task = createProductionTask({
      id: randomUUID(),
      title: body.title,
      objective: body.objective,
      createdAt: new Date().toISOString(),
      acceptanceCriteria: body.acceptanceCriteria as Array<{ id: string; description: string; required: boolean }>
    });
    const result = await createStoredProductionTask({ tenantId, idempotencyKey, task });
    return NextResponse.json({ ok: true, ...result }, {
      status: result.replayed ? 200 : 201,
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") return errorResponse("AUTH_REQUIRED", 401);
    if (error instanceof Error && error.message === "TENANT_CONTEXT_REQUIRED") return errorResponse("TENANT_CONTEXT_REQUIRED", 403);
    if (error instanceof Error && /^(TASK_|INVALID_|ACCEPTANCE_|DUPLICATE_)/.test(error.message)) return errorResponse(error.message, 400);
    return errorResponse(error instanceof Error ? error.message : "PRODUCTION_TASK_CREATE_FAILED", 503);
  }
}

export async function GET(request: Request) {
  try {
    const tenantId = await tenantFor(request);
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return errorResponse("TASK_ID_INVALID", 400);
    const result = await getStoredProductionTask(tenantId, id);
    if (!result) return errorResponse("TASK_NOT_FOUND", 404);
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") return errorResponse("AUTH_REQUIRED", 401);
    if (error instanceof Error && error.message === "TENANT_CONTEXT_REQUIRED") return errorResponse("TENANT_CONTEXT_REQUIRED", 403);
    return errorResponse("PRODUCTION_TASK_READ_FAILED", 503);
  }
}

export async function PATCH(request: Request) {
  try {
    const tenantId = await tenantFor(request);
    if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
      return errorResponse("CONTENT_TYPE_JSON_REQUIRED", 415);
    }
    const body: unknown = await request.json();
    if (!isObject(body) || typeof body.id !== "string" || !Number.isInteger(body.version) || !isObject(body.transition)) {
      return errorResponse("INVALID_TASK_TRANSITION_INPUT", 400);
    }
    const current = await getStoredProductionTask(tenantId, body.id);
    if (!current) return errorResponse("TASK_NOT_FOUND", 404);
    if (current.version !== body.version) return errorResponse("TASK_VERSION_CONFLICT", 409);
    const transition = body.transition as unknown as TaskTransitionInput;
    const next = transitionProductionTask(current.task, transition);
    const updated = await updateStoredProductionTask({
      tenantId,
      id: body.id,
      expectedVersion: current.version,
      task: next
    });
    if (!updated) return errorResponse("TASK_VERSION_CONFLICT", 409);
    return NextResponse.json({ ok: true, ...updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") return errorResponse("AUTH_REQUIRED", 401);
    if (error instanceof Error && error.message === "TENANT_CONTEXT_REQUIRED") return errorResponse("TENANT_CONTEXT_REQUIRED", 403);
    if (error instanceof Error && /^(INVALID_TASK_|SUCCESS_|FAILED_|BLOCKED_|UNKNOWN_|DUPLICATE_|INVALID_|ACCEPTANCE_)/.test(error instanceof Error ? error.message : "")) {
      return errorResponse(error instanceof Error ? error.message : "INVALID_TASK_TRANSITION", 400);
    }
    return errorResponse("PRODUCTION_TASK_TRANSITION_FAILED", 503);
  }
}
