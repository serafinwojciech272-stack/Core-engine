import { NextResponse } from "next/server";
import { getAgentManifest } from "@/lib/agent-contract";
import { getProductionReadiness } from "@/lib/production-readiness";
import { storageMode } from "@/lib/storage";
import { listCapabilityAdapters } from "@/lib/capability-adapters";
import { listCapabilityPacks } from "@/lib/capability-registry";
import { ensureCapabilityPacks } from "@/lib/capability-packs";
import { ensureExternalProviderPack } from "@/lib/external-provider-pack";
import { providerReadiness } from "@/lib/provider-adapters";
import { commercialRuntimeStatus } from "@/lib/commercial-runtime";
import { commercialRuntimeReadiness } from "@/lib/commercial-storage";
import { saasStatus } from "@/lib/saas-runtime";
import { guardMutation } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  ensureCapabilityPacks();
  ensureExternalProviderPack();
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
      providerReadiness: providerReadiness(),
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
  const documentCreate = /(utwórz|stwórz|wygeneruj|przygotuj|napisz|zrób|opracuj|exportuj|eksportuj).*(pdf|xls|xlsx|doc|docx|csv|arkusz|dokument)/.test(t) || /(pdf|xls|xlsx|doc|docx|csv|arkusz|dokument).*(utwórz|stwórz|wygeneruj|przygotuj|napisz|zrób|opracuj|exportuj|eksportuj)/.test(t);
  if (documentCreate) return ["DOCUMENT_CREATE", "Document Generation", "CREATIVE"];
  if (/(wizualiz|visualiz|wykres|dashboard.*kpi|data visualization|chart|graf)/.test(t)) return ["DATA_VISUALIZATION", "Data Visualization", "ANALYSIS"];\n  if (/(przekształć|przeksztalc|transform|konwertuj|convert).*(plik|file|pdf|doc|xls|csv)|(?:plik|file).*(przekształć|przeksztalc|transform|konwertuj|convert)/.test(t)) return ["DOCUMENT_TRANSFORM", "File Transformation", "OPERATIONS"];\n  if (/(image to video|obraz.*wideo|zdjęcie.*wideo|foto.*film|image.*video)/.test(t)) return ["IMAGE_TO_VIDEO", "Image to Video", "CREATIVE"];\n  if (/(create image|stwórz obraz|utwórz obraz|wygeneruj obraz|generuj obraz)/.test(t)) return ["IMAGE_CREATE", "Image Generation", "CREATIVE"];\n  if (/(change image|zmień obraz|edytuj obraz|edit image|retusz)/.test(t)) return ["IMAGE_EDIT", "Image Editing", "CREATIVE"];\n  if (/(pdf|xls|xlsx|doc|docx|csv|plik|dokument|dane|analizuj|analiza|tabela)/.test(t)) return ["DOCUMENT_ANALYSIS", "Document Intelligence", "ANALYSIS"];
  if (/(fotograf|zdję|obraz|image|png|jpg|jpeg|retusz|popraw)/.test(t)) return ["IMAGE_TASK", "Creative / Image Capability", "CREATIVE"];
  if (/(stronę|strona www|website|landing|witryn)/.test(t)) return ["WEB_BUILD", "Web Build", "BUILD"];
  if (/(aplikac|app|system|program|dashboard|narzędzi)/.test(t)) return ["APP_BUILD", "Application Build", "BUILD"];
  if (/(research|zbadaj|wyszukaj|sprawdź|konkurenc|rynek|ofert)/.test(t)) return ["RESEARCH", "Research & Web Intelligence", "RESEARCH"];
  if (/(plan|strateg|marketing|sprzedaż|proces|workflow|automatyz)/.test(t)) return ["OPERATIONS_PLAN", "Operations & Growth", "OPERATIONS"];
  return ["GENERAL_AGENT", "Core Intelligence", "INTELLIGENCE"];
}

function buildDemoPreview(intent: string, task: string, documentContext = "") {
  const source = documentContext ? "materiał dostarczony przez użytkownika" : "opis zadania użytkownika";
  const common = {
    source,
    quality: "DEMO_PREVIEW",
    verified: false,
    disclaimer: "To jest demonstracyjny preview planu i rezultatu. Nie oznacza wykonania działania zewnętrznego."
  };
  if (intent === "DATA_VISUALIZATION") return { ...common, title: "Interactive data visualization", summary: "Dane zostałyby zamienione w czytelny dashboard KPI z trendami, anomaliami i wnioskami.", highlights: ["KPI i trendy", "Wykresy dopasowane do danych", "Anomalie", "Executive summary"], deliverable: "Dashboard + insight brief" };\n  if (intent === "DOCUMENT_TRANSFORM") return { ...common, title: "File transformation", summary: "Materiał zostałby przekształcony do wskazanego formatu z zachowaniem struktury i kontroli jakości.", highlights: ["Ekstrakcja danych", "Transformacja formatu", "Normalizacja", "QA wyniku"], deliverable: "Transformed file + QA" };\n  if (intent === "IMAGE_TO_VIDEO") return { ...common, title: "Image-to-video concept", summary: "Obraz zostałby przygotowany do animacji z ruchem kamery, warstwami ruchu i określonym stylem.", highlights: ["Motion direction", "Camera movement", "Atmosphere", "Output format"], deliverable: "Video generation brief" };\n  if (intent === "IMAGE_CREATE") return { ...common, title: "Image generation", summary: "Core Engine przygotowałby prompt produkcyjny i parametry obrazu zgodne z celem użytkownika.", highlights: ["Composition", "Style", "Lighting", "Output format"], deliverable: "Image generation brief" };\n  if (intent === "IMAGE_EDIT") return { ...common, title: "Image editing", summary: "Core Engine określiłby operacje edycji bez zmiany elementów, które użytkownik chce zachować.", highlights: ["Subject preservation", "Edit operations", "Style control", "Final QA"], deliverable: "Image edit plan" };\n  if (intent === "DOCUMENT_ANALYSIS") return { ...common, title: "Executive document analysis", summary: "Dokument zostałby uporządkowany do warstwy faktów, ryzyk, anomalii i rekomendacji.", highlights: ["Fakty i liczby", "Ryzyka / terminy / zobowiązania", "Anomalie i braki danych", "Rekomendacje z priorytetem"], deliverable: "Raport analityczny + tabela ryzyk" };
  if (intent === "DOCUMENT_CREATE") return { ...common, title: "Professional document package", summary: "Core Engine przygotowałby strukturę dokumentu zgodną z celem biznesowym i formatem wyjściowym.", highlights: ["Struktura dokumentu", "Treść dopasowana do odbiorcy", "Kontrola kompletności", "Eksport do wskazanego formatu"], deliverable: "PDF / DOCX / XLS do akceptacji" };
  if (intent === "WEB_BUILD") return { ...common, title: "Website build plan", summary: "Powstałby zweryfikowany plan strony z architekturą informacji, UX, treścią i kryteriami publikacji.", highlights: ["Sitemap i user journey", "UX/UI", "Treść i CTA", "QA przed publikacją"], deliverable: "Wersja robocza strony + QA checklist" };
  if (intent === "APP_BUILD") return { ...common, title: "Application MVP blueprint", summary: "Zadanie zostałoby rozbite na funkcje, dane, role, API i kryteria akceptacji MVP.", highlights: ["Zakres MVP", "Model danych", "Workflow użytkownika", "Testy akceptacyjne"], deliverable: "MVP blueprint + backlog" };
  if (intent === "RESEARCH") return { ...common, title: "Research intelligence brief", summary: "Research zostałby podzielony na pytania, źródła, dowody, sprzeczności i wnioski.", highlights: ["Źródła i dowody", "Porównanie konkurencji", "Luki informacyjne", "Rekomendacje"], deliverable: "Research brief z evidence trail" };
  if (intent === "OPERATIONS_PLAN") return { ...common, title: "90-day operating plan", summary: "Plan zostałby rozłożony na priorytety, zależności, KPI i punkty kontrolne.", highlights: ["Priorytety", "KPI / outcome", "Właściciele zadań", "Review checkpoints"], deliverable: "Plan operacyjny + KPI board" };
  if (intent === "IMAGE_TASK") return { ...common, title: "Creative transformation plan", summary: "Materiał zostałby oceniony pod kątem celu, formatu publikacji i wymaganych operacji.", highlights: ["Ocena materiału", "Docelowy format", "Operacje edycji", "Final QA"], deliverable: "Wersja kreatywna do akceptacji" };
  return { ...common, title: "Core Intelligence task brief", summary: "Core Engine rozłożyłby zadanie na cel, ograniczenia, capability, plan i kryterium sukcesu.", highlights: ["Cel i zakres", "Capability routing", "Plan wykonania", "Verification"], deliverable: "Mission-ready execution brief" };
}

function buildEvidencePreview(task: string, attachments: AgentAttachment[], documentContext = "") {
  return [
    { label: "INPUT", value: task.slice(0, 120), status: "OBSERVED" },
    { label: "ATTACHMENTS", value: attachments.length ? attachments.map(x => x.name).join(", ") : "Brak załączników", status: attachments.length ? "OBSERVED" : "NOT_REQUIRED" },
    { label: "DOCUMENT CONTEXT", value: documentContext ? "Tekst wyodrębniony i przekazany do analizy" : "Brak", status: documentContext ? "OBSERVED" : "NOT_AVAILABLE" }
  ];
}

function fallbackAgent(task: string, attachments: AgentAttachment[], documentContext = "") {
  const [intent, capability, kind] = classifyTask(task);
  const needsAttachment = ["DOCUMENT_ANALYSIS", "DATA_VISUALIZATION", "DOCUMENT_TRANSFORM", "IMAGE_TASK", "IMAGE_EDIT", "IMAGE_TO_VIDEO"].includes(intent) && attachments.length === 0;
  const plan = needsAttachment
    ? ["Uzupełnij wymagany plik lub materiał wejściowy", "Zweryfikuję format, zakres i kompletność danych", "Przygotuję analizę oraz wynik do akceptacji"]
    : intent === "WEB_BUILD"
      ? ["Zdefiniuję cel, odbiorcę, strukturę i wymagania strony", "Przygotuję architekturę, UX/UI, treść i plan implementacji", "Zbuduję wersję roboczą i przeprowadzę kontrolę jakości", "Przedstawię rezultat przed publikacją lub wdrożeniem"]
      : intent === "APP_BUILD"
        ? ["Rozbiję wymagania na funkcje, dane i interfejs", "Zaprojektuję architekturę oraz plan implementacji", "Zbuduję MVP i wykonam testy", "Przedstawię gotowy rezultat do akceptacji"]
        : intent === "DOCUMENT_CREATE"
          ? ["Zdefiniuję format, strukturę i wymagania wyniku", "Przygotuję treść, dane oraz układ dokumentu", "Wygeneruję wersję roboczą i sprawdzę kompletność", "Przedstawię plik do akceptacji lub dalszego użycia"]
          : intent === "DOCUMENT_ANALYSIS"
          ? ["Odczytam i uporządkuję dane z załączonego materiału", "Wykryję kluczowe fakty, ryzyka, anomalie i zależności", "Przygotuję syntetyczny raport oraz rekomendacje"]
          : intent === "IMAGE_TASK"
            ? ["Zweryfikuję materiał i oczekiwany efekt", "Dobiorę operacje edycji zgodne z celem", "Przygotuję wersję wynikową do akceptacji"]
            : ["Zrozumiem cel i kryterium sukcesu", "Dobiorę odpowiednie capability oraz źródła", "Przygotuję plan działania i kryteria weryfikacji", "Wykonanie efektu zewnętrznego pozostawię za bramką akceptacji"];
  const reply = needsAttachment
    ? "Rozumiem zadanie: " + task + ". Do tego typu pracy potrzebuję materiału wejściowego. Dodaj plik, a Core Engine przejdzie do analizy."
    : "Rozumiem zadanie: " + task + ". Zaklasyfikowałem je jako " + kind.toLowerCase() + " i dobrałem capability „" + capability + "”. Najpierw przygotuję kontrolowany plan, a wykonanie działania powodującego efekt zewnętrzny wymaga Twojej akceptacji.";
  return { reply, intent, confidence: intent === "GENERAL_AGENT" ? 0.72 : 0.94, plan, requiresApproval: !needsAttachment, execution: "HUMAN_APPROVAL_REQUIRED", needsAttachment, capability, preview: buildDemoPreview(intent, task, documentContext), evidence: buildEvidencePreview(task, attachments, documentContext), successCriteria: ["Plan odpowiada intencji użytkownika", "Wymagane dane wejściowe są jawne", "Ryzyko i approval gate są widoczne", "Rezultat jest weryfikowalny przed użyciem"] };
}

async function generateAgentResponse(task: string, attachments: AgentAttachment[], documentContext = "") {
  const base = process.env.CORE_ENGINE_LLM_BASE_URL;
  const key = process.env.CORE_ENGINE_LLM_API_KEY;
  const model = process.env.CORE_ENGINE_LLM_MODEL;
  if (!base || !key || !model) return fallbackAgent(task, attachments, documentContext);
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
      "ATTACHMENTS: " + JSON.stringify(attachments),
      "DOCUMENT CONTEXT: " + documentContext.slice(0, 50000)
    ].join("\\n");
    const response = await fetch(base.replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ model, temperature: 0.2, messages: [{ role: "system", content: "You are a strict JSON API." }, { role: "user", content: prompt }] }),
      signal: controller.signal
    });
    if (!response.ok) return fallbackAgent(task, attachments, documentContext);
    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return fallbackAgent(task, attachments, documentContext);
    const parsed = JSON.parse(content.replace(/^\x60\x60\x60json\s*/i, "").replace(/\s*\x60\x60\x60$/, ""));
    if (!parsed.reply || !Array.isArray(parsed.plan)) return fallbackAgent(task, attachments, documentContext);
    return { reply: String(parsed.reply), intent: String(parsed.intent || "GENERAL_AGENT"), confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.8)), plan: parsed.plan.map(String).slice(0, 5), requiresApproval: parsed.requiresApproval !== false, execution: "HUMAN_APPROVAL_REQUIRED", capability: String(parsed.capability || "Core Intelligence"), needsAttachment: Boolean(parsed.needsAttachment), preview: buildDemoPreview(String(parsed.intent || "GENERAL_AGENT"), task, documentContext), evidence: buildEvidencePreview(task, attachments, documentContext), successCriteria: ["Plan odpowiada intencji użytkownika", "Wymagane dane wejściowe są jawne", "Ryzyko i approval gate są widoczne", "Rezultat jest weryfikowalny przed użyciem"] };
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
    const documentContext = typeof body.documentContext === "string" ? body.documentContext.slice(0, 50000) : "";
    const attachments = (Array.isArray(body.attachments) ? body.attachments : []).slice(0, 6).map((x: AgentAttachment) => ({ name: String(x.name || "").slice(0, 180), type: String(x.type || "application/octet-stream").slice(0, 120), size: Math.max(0, Math.min(Number(x.size) || 0, 50000000)) })).filter((x: AgentAttachment) => x.name);
    const result = await generateAgentResponse(task, attachments, documentContext);
    return NextResponse.json({ ok: true, ...result, control: { actor: "HUMAN", gate: "APPROVAL_REQUIRED", sideEffects: "BLOCKED_UNTIL_APPROVED", audit: true } });
  } catch {
    return NextResponse.json({ ok: false, error: "AGENT_REQUEST_INVALID" }, { status: 400 });
  }
}
