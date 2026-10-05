import { NextResponse } from "next/server";
import { getAgentManifest } from "@/lib/agent-contract";
import { getProductionReadiness } from "@/lib/production-readiness";
import { storageMode } from "@/lib/storage";
import { listCapabilityAdapters } from "@/lib/capability-adapters";
import { listCapabilityPacks } from "@/lib/capability-registry";
import { ensureCapabilityPacks } from "@/lib/capability-packs";
import { commercialRuntimeStatus } from "@/lib/commercial-runtime";
import { commercialRuntimeReadiness } from "@/lib/commercial-storage";
import { saasStatus } from "@/lib/saas-runtime";
import { guardMutation } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  ensureCapabilityPacks();
  const manifest = getAgentManifest();
  const persistence = storageMode();

  return NextResponse.json({
    ok: true,
    agent: manifest,
    runtime: {
      status: "READY",
      persistence,
      durable: persistence === "supabase",
      adapters: listCapabilityAdapters(),
      capabilityPacks: listCapabilityPacks().length,
      execution: getProductionReadiness().execution,
      liveExternalSideEffects: false,
      approvalRequiredForHighRiskActions: true,
      commercialRuntime: commercialRuntimeStatus(),
      commercialReadiness: commercialRuntimeReadiness(),
      saas: saasStatus()
    },
    integration: {
      plan: "POST /api/engine",
      missionControl: "POST /api/mission",
      capabilityDiscovery: "GET /api/capabilities",
      health: "GET /api/health"
    }
  }, {
    headers: { "Cache-Control": "public, max-age=30, s-maxage=30" }
  });
}


type AgentAttachment = { name: string; type?: string; size?: number };
const MAX_TASK = 12000;

function classifyTask(task: string) {
  const t = task.toLowerCase();
  if (/(pdf|xls|xlsx|doc|docx|csv|plik|dokument|dane|analizuj|analiza|tabela)/.test(t)) return ["DOCUMENT_ANALYSIS", "Document Intelligence", "ANALYSIS"];
  if (/(fotograf|zdję|obraz|image|png|jpg|jpeg|retusz|popraw)/.test(t)) return ["IMAGE_TASK", "Creative / Image Capability", "CREATIVE"];
  if (/(stronę|strona www|website|landing|witryn)/.test(t)) return ["WEB_BUILD", "Web Build", "BUILD"];
  if (/(aplikac|app|system|program|dashboard|narzędzi)/.test(t)) return ["APP_BUILD", "Application Build", "BUILD"];
  if (/(research|zbadaj|wyszukaj|sprawdź|konkurenc|rynek|ofert)/.test(t)) return ["RESEARCH", "Research & Web Intelligence", "RESEARCH"];
  if (/(plan|strateg|marketing|sprzedaż|proces|workflow|automatyz)/.test(t)) return ["OPERATIONS_PLAN", "Operations & Growth", "OPERATIONS"];
  return ["GENERAL_AGENT", "Core Intelligence", "INTELLIGENCE"];
}

function fallbackAgent(task: string, attachments: AgentAttachment[]) {
  const [intent, capability, kind] = classifyTask(task);
  const needsAttachment = ["DOCUMENT_ANALYSIS", "IMAGE_TASK"].includes(intent) && attachments.length === 0;
  const plan = needsAttachment
    ? ["Uzupełnij wymagany plik lub materiał wejściowy", "Zweryfikuję format, zakres i kompletność danych", "Przygotuję analizę oraz wynik do akceptacji"]
    : intent === "WEB_BUILD"
      ? ["Zdefiniuję cel, odbiorcę, strukturę i wymagania strony", "Przygotuję architekturę, UX/UI, treść i plan implementacji", "Zbuduję wersję roboczą i przeprowadzę kontrolę jakości", "Przedstawię rezultat przed publikacją lub wdrożeniem"]
      : intent === "APP_BUILD"
        ? ["Rozbiję wymagania na funkcje, dane i interfejs", "Zaprojektuję architekturę oraz plan implementacji", "Zbuduję MVP i wykonam testy", "Przedstawię gotowy rezultat do akceptacji"]
        : intent === "DOCUMENT_ANALYSIS"
          ? ["Odczytam i uporządkuję dane z załączonego materiału", "Wykryję kluczowe fakty, ryzyka, anomalie i zależności", "Przygotuję syntetyczny raport oraz rekomendacje"]
          : intent === "IMAGE_TASK"
            ? ["Zweryfikuję materiał i oczekiwany efekt", "Dobiorę operacje edycji zgodne z celem", "Przygotuję wersję wynikową do akceptacji"]
            : ["Zrozumiem cel i kryterium sukcesu", "Dobiorę odpowiednie capability oraz źródła", "Przygotuję plan działania i kryteria weryfikacji", "Wykonanie efektu zewnętrznego pozostawię za bramką akceptacji"];
  const reply = needsAttachment
    ? "Rozumiem zadanie: " + task + ". Do tego typu pracy potrzebuję materiału wejściowego. Dodaj plik, a Core Engine przejdzie do analizy."
    : "Rozumiem zadanie: " + task + ". Zaklasyfikowałem je jako " + kind.toLowerCase() + " i dobrałem capability „" + capability + "”. Najpierw przygotuję kontrolowany plan, a wykonanie działania powodującego efekt zewnętrzny wymaga Twojej akceptacji.";
  return { reply, intent, confidence: intent === "GENERAL_AGENT" ? 0.72 : 0.94, plan, requiresApproval: !needsAttachment, execution: "HUMAN_APPROVAL_REQUIRED", needsAttachment, capability };
}

async function generateAgentResponse(task: string, attachments: AgentAttachment[]) {
  const base = process.env.CORE_ENGINE_LLM_BASE_URL;
  const key = process.env.CORE_ENGINE_LLM_API_KEY;
  const model = process.env.CORE_ENGINE_LLM_MODEL;
  if (!base || !key || !model) return fallbackAgent(task, attachments);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const prompt = [
      "You are Core Engine AI, a universal task-planning agent.",
      "Return ONLY valid JSON with keys: reply, intent, confidence, plan, requiresApproval, execution, capability, needsAttachment.",
      "Never claim an external side effect has already happened. Never invent attached file contents.",
      "execution must be HUMAN_APPROVAL_REQUIRED or SIMULATION_ONLY. Plan must contain 2-5 concrete stages.",
      "Task classes: BUILD, ANALYSIS, CREATIVE, RESEARCH, OPERATIONS, INTELLIGENCE.",
      "TASK: " + task,
      "ATTACHMENTS: " + JSON.stringify(attachments)
    ].join("\n");
    const response = await fetch(base.replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ model, temperature: 0.2, messages: [{ role: "system", content: "You are a strict JSON API." }, { role: "user", content: prompt }] }),
      signal: controller.signal
    });
    if (!response.ok) return fallbackAgent(task, attachments);
    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return fallbackAgent(task, attachments);
    const parsed = JSON.parse(content.replace(/^\x60\x60\x60json\s*/i, "").replace(/\s*\x60\x60\x60$/, ""));
    if (!parsed.reply || !Array.isArray(parsed.plan)) return fallbackAgent(task, attachments);
    return { reply: String(parsed.reply), intent: String(parsed.intent || "GENERAL_AGENT"), confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.8)), plan: parsed.plan.map(String).slice(0, 5), requiresApproval: parsed.requiresApproval !== false, execution: "HUMAN_APPROVAL_REQUIRED", capability: String(parsed.capability || "Core Intelligence"), needsAttachment: Boolean(parsed.needsAttachment) };
  } catch {
    return fallbackAgent(task, attachments);
  } finally { clearTimeout(timeout); }
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 64000) return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413 });
    const body = raw ? JSON.parse(raw) : {};
    const task = typeof body.task === "string" ? body.task.trim() : "";
    if (!task) return NextResponse.json({ ok: false, error: "TASK_REQUIRED" }, { status: 400 });
    if (task.length > MAX_TASK) return NextResponse.json({ ok: false, error: "TASK_TOO_LONG" }, { status: 400 });
    const attachments = (Array.isArray(body.attachments) ? body.attachments : []).slice(0, 6).map((x: AgentAttachment) => ({ name: String(x.name || "").slice(0, 180), type: String(x.type || "application/octet-stream").slice(0, 120), size: Math.max(0, Math.min(Number(x.size) || 0, 50000000)) })).filter((x: AgentAttachment) => x.name);
    const result = await generateAgentResponse(task, attachments);
    return NextResponse.json({ ok: true, ...result, control: { actor: "HUMAN", gate: "APPROVAL_REQUIRED", sideEffects: "BLOCKED_UNTIL_APPROVED", audit: true } });
  } catch {
    return NextResponse.json({ ok: false, error: "AGENT_REQUEST_INVALID" }, { status: 400 });
  }
}
