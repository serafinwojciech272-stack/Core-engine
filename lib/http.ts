import {NextResponse} from "next/server";import{authenticate}from "@/lib/auth";import{rateLimit}from "@/lib/rate-limit";import{resolveSaaSContext}from "@/lib/saas-runtime";import{createHash,timingSafeEqual}from "node:crypto";
export function reject(error:string,status:number){return NextResponse.json({ok:false,error},{status})}
export function guardMutation(request:Request,scope:string){const ct=(request.headers.get("content-type")||"").toLowerCase();const multipartAllowed=scope==="agent-file"&&ct.startsWith("multipart/form-data;");if(!ct.startsWith("application/json")&&!multipartAllowed)return reject("CONTENT_TYPE_JSON_REQUIRED",415);const origin=request.headers.get("origin"),host=request.headers.get("host");if(origin){try{if(new URL(origin).host!==host)return reject("CSRF_ORIGIN_MISMATCH",403)}catch{return reject("CSRF_ORIGIN_INVALID",403)}}if(request.headers.get("sec-fetch-site")==="cross-site")return reject("CSRF_CROSS_SITE",403);try{authenticate(request,true)}catch{return reject("AUTH_REQUIRED",401)}const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown",rl=rateLimit(scope+":"+ip);if(!rl.allowed){const r=reject("RATE_LIMITED",429);r.headers.set("Retry-After",String(Math.ceil((rl.retryAfterMs||1000)/1000)));return r}return null}

// ---- Route authorization helpers (P1 audit closure) ----

export function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest(), hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export type TenantAuth = { ok: true; tenantId: string; anonymous: boolean } | { ok: false; response: NextResponse };

/**
 * Resolves the caller's tenant ONLY after authentication: a Supabase user session, or a valid API key.
 * Anonymous callers pass only when CORE_ENGINE_ALLOW_ANONYMOUS=true (demo) and `allowAnonymous` is not false.
 * Client-supplied tenant ids are never trusted.
 */
export async function authorizeTenant(request: Request, options: { allowAnonymous?: boolean } = {}): Promise<TenantAuth> {
  try {
    const context = await resolveSaaSContext(request);
    let anonymous = false;
    if (!context.identity) {
      const actor = authenticate(request, true);
      anonymous = actor.kind === "anonymous";
      if (anonymous && options.allowAnonymous === false) return { ok: false, response: reject("AUTH_REQUIRED", 401) };
    }
    const tenantId = context.identity?.tenantId || context.legacyTenant?.tenantId;
    if (!tenantId) return { ok: false, response: reject("TENANT_CONTEXT_REQUIRED", 403) };
    return { ok: true, tenantId, anonymous };
  } catch (error) {
    const message = error instanceof Error ? error.message : "AUTH_REQUIRED";
    return { ok: false, response: reject(message === "AUTH_REQUIRED" ? "AUTH_REQUIRED" : "TENANT_CONTEXT_REQUIRED", message === "AUTH_REQUIRED" ? 401 : 403) };
  }
}

type QuotaBucket = { hourStart: number; ipCounts: Map<string, number>; dayStart: number; dayCount: number };
const quotaRoot = globalThis as typeof globalThis & { __anonLlmQuota?: QuotaBucket };

/** Caps paid LLM usage by anonymous callers (demo mode): per-IP per hour and a global daily ceiling. */
export function anonymousLlmQuota(request: Request): NextResponse | null {
  let actor;
  try { actor = authenticate(request, false); } catch { return null; }
  if (actor.kind !== "anonymous") return null;
  const now = Date.now();
  const q = (quotaRoot.__anonLlmQuota ??= { hourStart: now, ipCounts: new Map(), dayStart: now, dayCount: 0 });
  if (now - q.hourStart >= 3_600_000) { q.hourStart = now; q.ipCounts.clear(); }
  if (now - q.dayStart >= 86_400_000) { q.dayStart = now; q.dayCount = 0; }
  const perIp = Number(process.env.ANON_LLM_PER_IP_PER_HOUR) || 10;
  const daily = Number(process.env.ANON_LLM_DAILY) || 100;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const used = q.ipCounts.get(ip) || 0;
  if (used >= perIp || q.dayCount >= daily) return reject("ANONYMOUS_LLM_QUOTA_EXCEEDED", 429);
  q.ipCounts.set(ip, used + 1); q.dayCount++;
  return null;
}
