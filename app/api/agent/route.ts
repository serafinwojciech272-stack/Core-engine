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
  if (/(stronę|strona www|website|landing|witryn)/.test(t)) return ["WEB_BUILD", "Web Build", "BUILD"];
  if (/(aplikac|app|system|program|dashboard|narzędzi)/.test(t)) return ["APP_BUILD", "Application Build", "BUILD"];
  if (/(research|zbadaj|wyszukaj|sprawdź|konkurenc|rynek|konkurent|benchmark|ofert)/.test(t)) return ["RESEARCH", "Research & Web Intelligence", "RESEARCH"];
  if (/(pdf|xls|xlsx|doc|docx|csv|plik|dokument|tabela|załącznik)/.test(t)) return ["DOCUMENT_ANALYSIS", "Document Intelligence", "ANALYSIS"];
  if (/(fotograf|zdję|obraz|image|png|jpg|jpeg|retusz|popraw)/.test(t)) return ["IMAGE_TASK", "Creative / Image Capability", "CREATIVE"];
  if (/(plan|strateg|marketing|sprzedaż|proces|workflow|automatyz)/.test(t)) return ["OPERATIONS_PLAN", "Operations & Growth", "OPERATIONS"];
  return ["GENERAL_AGENT", "Core Intelligence", "INTELLIGENCE"];
}

export function fallbackAgent(task: string, attachments: AgentAttachment[], documentContext = "") {
  const [intent, capability, kind] = classifyTask(task);
  const needsAttachment = ["DOCUMENT_ANALYSIS", "IMAGE_TASK"].includes(intent) && attachments.length === 0;

  let plan: string[];
  let reply: string;

  if (needsAttachment) {
    plan = [
      "Uzupełnij wymagany materiał wejściowy i określ kryterium sukcesu",
      "Zweryfikuję format, zakres, kompletność oraz jakość danych",
      "Przeprowadzę analizę i oddzielę fakty od wniosków",
      "Przygotuję wynik, ryzyka i rekomendacje do akceptacji"
    ];
    reply = "Rozumiem zadanie: " + task + ". Do tego typu pracy potrzebuję materiału wejściowego. Dodaj plik, a Core Engine przejdzie od razu do analizy.";
  } else if (intent === "OPERATIONS_PLAN" && /(marketing|market|kampani|promoc|sprzedaż|90 dni|90-dni)/i.test(task)) {
    plan = [
      "DNI 1–14 · DIAGNOZA I POZYCJONOWANIE — zdefiniuję ICP, ofertę główną, przewagę, persony i 3–5 hipotez wzrostu; ustawię baseline: ruch, leady, konwersja, CAC i przychód.",
      "DNI 15–30 · FUNDAMENT — dopracuję komunikat, landing page/ofertę, CTA, tracking i lejek; uruchomię pierwsze testy treści oraz źródeł leadów.",
      "DNI 31–60 · AKWIZYCJA — prowadzę równolegle 2–3 kanały o najwyższym potencjale (np. Google/SEO, social/content, outbound/partnerstwa), z tygodniowym testem kreacji, oferty i CTA.",
      "DNI 61–75 · OPTYMALIZACJA — odcinam kanały poniżej progu opłacalności, zwiększam budżet na zwycięskie segmenty i poprawiam konwersję na każdym etapie lejka.",
      "DNI 76–90 · SKALOWANIE — utrwalam zwycięskie kampanie, automatyzuję follow-up, buduję plan retencji i przygotowuję dashboard KPI oraz backlog testów na kolejne 90 dni."
    ];
    reply = "Core Engine przygotował konkretny 90-dniowy plan marketingowy. Priorytetem jest najpierw ustalenie ICP i baseline, potem szybkie testy kanałów, następnie optymalizacja ekonomiki pozyskania i dopiero na końcu skalowanie. KPI kontrolne: liczba kwalifikowanych leadów, konwersja, CAC, wartość sprzedaży, koszt kanału i udział powracających klientów. Nie deklaruję wykonania kampanii — wykonanie działań zewnętrznych pozostaje za bramką akceptacji.";
  } else if (intent === "WEB_BUILD") {
    plan = [
      "Zdefiniuję cel biznesowy, odbiorcę, ofertę i główną konwersję",
      "Zaprojektuję strukturę informacji, UX, sekcje, CTA oraz wymagania SEO",
      "Przygotuję treść i komponenty wersji roboczej",
      "Wykonam kontrolę responsywności, dostępności i jakości przed publikacją"
    ];
    reply = "Zadanie zaklasyfikowane jako BUILD. Wynikiem będzie specyfikacja strony, struktura UX/UI, treść, komponenty i lista testów. Publikacja lub zmiana zewnętrznego systemu wymaga Twojej akceptacji.";
  } else if (intent === "APP_BUILD") {
    plan = [
      "Rozbiję cel na użytkowników, przypadki użycia i kryteria akceptacji",
      "Zaprojektuję model danych, API, interfejs i architekturę MVP",
      "Zbuduję najkrótszy działający przepływ end-to-end",
      "Uruchomię testy funkcjonalne, bezpieczeństwa i regresji"
    ];
    reply = "Zadanie zaklasyfikowane jako APP BUILD. Core Engine przygotuje MVP wokół mierzalnego przypadku użycia, zamiast generować sam opis aplikacji. Wdrożenie pozostaje kontrolowane przez approval gate.";
  } else if (intent === "RESEARCH") {
    plan = [
      "Zdefiniuję pytanie badawcze, zakres i kryteria wiarygodności źródeł",
      "Zbiorę i uporządkuję dane oraz oddzielę fakty od interpretacji",
      "Porównam opcje, konkurencję, ryzyka i luki informacyjne",
      "Przygotuję rekomendację z dowodami, confidence i kolejnymi krokami"
    ];
    reply = "Zadanie zaklasyfikowane jako RESEARCH. Wynikiem ma być decyzja oparta na źródłach, a nie ogólny tekst: fakty, porównanie, ryzyka, niepewności i rekomendacja.";
  } else if (intent === "DOCUMENT_ANALYSIS") {
    plan = [
      "Odczytam i uporządkuję zawartość załączonego materiału",
      "Wyodrębnię kluczowe fakty, liczby, anomalie, ryzyka i zależności",
      "Porównam ustalenia z celem analizy i wskażę luki w danych",
      "Przygotuję raport: najważniejsze ustalenia → wpływ → rekomendowane działania"
    ];
    reply = "Materiał wejściowy został przyjęty. Core Engine nie będzie udawał analizy bez danych: najpierw ekstrakcja i walidacja, potem ustalenia, ryzyka i rekomendacje.";
  } else {
    plan = [
      "Zrozumiem cel, ograniczenia i mierzalne kryterium sukcesu",
      "Dobiorę capability, narzędzia i źródła odpowiednie do problemu",
      "Zbuduję konkretny plan z warunkami weryfikacji i przewidywanym wynikiem",
      "Przedstawię rezultat przed każdym działaniem powodującym efekt zewnętrzny"
    ];
    reply = "Rozumiem zadanie: " + task + ". Zaklasyfikowałem je jako " + kind.toLowerCase() + " i dobrałem capability „" + capability + "”. Najpierw powstaje konkretny plan i kryterium sukcesu; efekt zewnętrzny pozostaje za bramką akceptacji.";
  }

  const objective = task.trim();
  const deliverables = intent === "OPERATIONS_PLAN" && /(marketing|market|kampani|90 dni|90-dni)/i.test(task)
    ? ["90-dniowy plan etapowy", "priorytetowe kanały i eksperymenty", "KPI i punkty kontroli tygodniowej", "backlog działań na kolejne 90 dni"]
    : intent === "DOCUMENT_ANALYSIS"
      ? ["ekstrakt treści", "ustalenia i anomalie", "ryzyka i luki danych", "rekomendacje"]
      : intent === "RESEARCH"
        ? ["zestawienie faktów i źródeł", "porównanie opcji", "ryzyka i niepewności", "rekomendacja"]
        : ["konkretny plan wykonania", "kryteria akceptacji", "wynik do weryfikacji"];
  const assumptions = needsAttachment ? ["Materiał wejściowy nie został jeszcze dostarczony."] : ["Brak danych biznesowych poza treścią zadania; wartości wymagające danych użytkownika zostaną oznaczone jako założenia."];
  const kpis = intent === "OPERATIONS_PLAN" && /(marketing|market|kampani|90 dni|90-dni)/i.test(task)
    ? ["kwalifikowane leady", "conversion rate", "CAC", "wartość sprzedaży", "koszt kanału", "udział klientów powracających"]
    : ["czas realizacji", "kompletność wyniku", "zgodność z kryteriami akceptacji"];
  const risks = needsAttachment ? ["brak materiału źródłowego"] : ["niepełny kontekst biznesowy", "ryzyko błędnych założeń bez danych źródłowych"];
  return { reply, intent, confidence: intent === "GENERAL_AGENT" ? 0.72 : 0.95, plan, requiresApproval: !needsAttachment, execution: "HUMAN_APPROVAL_REQUIRED", needsAttachment, capability, objective, deliverables, assumptions, kpis, risks, nextAction: needsAttachment ? "Dodaj wymagany materiał wejściowy." : "Przejrzyj plan i utwórz Mission po akceptacji." };
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
      "Return ONLY valid JSON with keys: reply, intent, confidence, plan, requiresApproval, execution, capability, needsAttachment, objective, deliverables, assumptions, kpis, risks, nextAction.",
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
    const fallback = fallbackAgent(task, attachments, documentContext);
    return { ...fallback, reply: String(parsed.reply), intent: String(parsed.intent || fallback.intent), confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || fallback.confidence)), plan: parsed.plan.map(String).slice(0, 5), requiresApproval: parsed.requiresApproval !== false, execution: "HUMAN_APPROVAL_REQUIRED", capability: String(parsed.capability || fallback.capability), needsAttachment: Boolean(parsed.needsAttachment), objective: String(parsed.objective || fallback.objective), deliverables: Array.isArray(parsed.deliverables) ? parsed.deliverables.map(String).slice(0, 8) : fallback.deliverables, assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.map(String).slice(0, 8) : fallback.assumptions, kpis: Array.isArray(parsed.kpis) ? parsed.kpis.map(String).slice(0, 10) : fallback.kpis, risks: Array.isArray(parsed.risks) ? parsed.risks.map(String).slice(0, 8) : fallback.risks, nextAction: String(parsed.nextAction || fallback.nextAction) };
  } catch {
    return fallbackAgent(task, attachments);
  } finally { clearTimeout(timeout); }
}

export async function POST(request: Request) {
  const guard = guardMutation(request, "agent");
  if (guard) return guard;
  const ip = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  const rl = rateLimit("agent:" + ip);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
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
