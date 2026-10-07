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
import sharp from "sharp";
import { executeRoutedMultiTask } from "@/lib/multitask-engine";

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
type AgentArtifact = { type: "website" | "image" | "file" | "video" | "data"; title: string; html?: string; dataUrl?: string; provider?: string; status: string; filename?: string; mimeType?: string; text?: string };

function taskImagePrompt(task: string) {
  const t = task.toLowerCase();
  if (/(czarno[- ]?biał|czarno[- ]?bial|black and white|black & white|grayscale|greyscale|odbarw|desatur)/.test(t)) {
    return "Convert the source photo to a natural black-and-white grayscale image. Preserve the exact person, facial features, composition, framing, lighting and details. Do not add or remove objects.";
  }
  return task.replace(/^(popraw|edytuj|zmień|zmien|retuszuj|ulepsz|zrób|zrob)\s+(tę|te|ten|je)?\s*(fotografię|zdjęcie|obraz|foto)?/i, "").trim() || "Improve the photo naturally while preserving the subject, facial features and composition.";
}

async function executeLocalPhotoEnhancement(imageData: string, task = ""): Promise<AgentArtifact> {
  const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("IMAGE_DATA_INVALID");
  const input = Buffer.from(match[2], "base64");
  const grayscale = /(czarno[- ]?biał|czarno[- ]?bial|black and white|black & white|grayscale|greyscale|odbarw|desatur)/i.test(task);
  const pipeline = sharp(input).rotate();
  const output = grayscale
    ? await pipeline.grayscale().png({ compressionLevel: 9 }).toBuffer()
    : await pipeline.normalize().modulate({ saturation: 1.04, brightness: 1.02 }).sharpen({ sigma: 1.1, m1: 0.6, m2: 2.0 }).png({ compressionLevel: 9 }).toBuffer();
  return {
    type: "image",
    title: grayscale ? "Zdjęcie czarno-białe" : "Zdjęcie po poprawie jakości",
    status: "EXECUTED",
    provider: "core-local-sharp",
    dataUrl: "data:image/png;base64," + output.toString("base64")
  };
}

async function executeImageEdit(imageData: string, task: string): Promise<AgentArtifact> {
  const key = process.env.CORE_ENGINE_IMAGE_API_KEY?.trim();
  if (!key) return executeLocalPhotoEnhancement(imageData, task);
  const url = process.env.CORE_ENGINE_IMAGE_API_URL?.trim() || "https://api.openai.com/v1/images/edits";
  const model = process.env.CORE_ENGINE_IMAGE_MODEL?.trim() || "gpt-image-2";
  const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("IMAGE_DATA_INVALID");
  const bytes = Buffer.from(match[2], "base64");
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", taskImagePrompt(task));
  form.append("image", new Blob([bytes], { type: match[1] }), "source." + (match[1].split("/")[1] || "png"));
  form.append("response_format", "b64_json");
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(url, { method: "POST", headers: { Authorization: "Bearer " + key }, body: form, signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error("IMAGE_PROVIDER_HTTP_" + response.status);
    const b64 = body?.data?.[0]?.b64_json;
    if (!b64) throw new Error("IMAGE_PROVIDER_NO_OUTPUT");
    return { type: "image", title: "Zdjęcie po edycji", status: "EXECUTED", provider: model, dataUrl: "data:image/png;base64," + b64 };
  } finally { clearTimeout(timer); }
}

function buildWebsiteArtifact(task: string): AgentArtifact {
  const safe = task.replace(/[<>]/g, "").slice(0, 500);
  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Core Engine · Generated Website</title><style>body{margin:0;font-family:Inter,system-ui,sans-serif;background:#0b1120;color:#f8fafc}header{padding:24px 7%;display:flex;justify-content:space-between;border-bottom:1px solid #334155}nav{opacity:.8}main{max-width:1100px;margin:auto;padding:90px 7%}.ey{color:#f59e0b;text-transform:uppercase;letter-spacing:.18em;font-size:12px}h1{font-size:clamp(42px,7vw,82px);line-height:.95;max-width:850px;margin:18px 0}p{color:#cbd5e1;font-size:18px;line-height:1.7;max-width:720px}.cta{display:inline-block;margin-top:22px;padding:15px 22px;border-radius:12px;background:#f59e0b;color:#111827;text-decoration:none;font-weight:800}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:70px}.card{padding:25px;border:1px solid #334155;border-radius:18px;background:#1e293b}.card b{display:block;margin-bottom:10px}@media(max-width:700px){.grid{grid-template-columns:1fr}main{padding-top:55px}}</style></head><body><header><strong>CORE ENGINE SITE</strong><nav>Oferta · O nas · Kontakt</nav></header><main><span class="ey">GENERATED BY CORE ENGINE AI</span><h1>Strona zbudowana z Twojego polecenia.</h1><p>${safe}</p><a class="cta" href="#contact">Skontaktuj się</a><section class="grid"><article class="card"><b>Oferta</b><span>Jasna propozycja wartości i najważniejsze usługi.</span></article><article class="card"><b>Dlaczego my</b><span>Dowody, korzyści i elementy budujące zaufanie.</span></article><article class="card"><b>Kontakt</b><span>Prosty następny krok bez zbędnego tarcia.</span></article></section></main></body></html>`;
  return { type: "website", title: "Gotowa strona WWW", status: "EXECUTED", provider: "core-html-builder", html };
}

const MAX_TASK = 12000;

function classifyTask(task: string) {
  const t = task.toLowerCase();
  const documentCreate = /(utwórz|stwórz|wygeneruj|przygotuj|napisz|zrób|opracuj|exportuj|eksportuj).*(pdf|xls|xlsx|doc|docx|csv|arkusz|dokument)/.test(t) || /(pdf|xls|xlsx|doc|docx|csv|arkusz|dokument).*(utwórz|stwórz|wygeneruj|przygotuj|napisz|zrób|opracuj|exportuj|eksportuj)/.test(t);
  if (documentCreate) return ["DOCUMENT_CREATE", "Document Generation", "CREATIVE"];
  if (/(wizualiz|visualiz|wykres|dashboard.*kpi|data visualization|chart|graf)/.test(t)) return ["DATA_VISUALIZATION", "Data Visualization", "ANALYSIS"];
  if (/(przekształć|przeksztalc|transform|konwertuj|convert).*(plik|file|pdf|doc|xls|csv)|(?:plik|file).*(przekształć|przeksztalc|transform|konwertuj|convert)/.test(t)) return ["DOCUMENT_TRANSFORM", "File Transformation", "OPERATIONS"];
  if (/(image to video|obraz.*wideo|zdjęcie.*wideo|foto.*film|image.*video)/.test(t)) return ["IMAGE_TO_VIDEO", "Image to Video", "CREATIVE"];
  if (/(create image|stwórz obraz|utwórz obraz|wygeneruj obraz|generuj obraz)/.test(t)) return ["IMAGE_CREATE", "Image Generation", "CREATIVE"];
  if (/(change image|zmień obraz|edytuj obraz|edit image|retusz)/.test(t)) return ["IMAGE_EDIT", "Image Editing", "CREATIVE"];
  if (/(pdf|xls|xlsx|doc|docx|csv|plik|dokument|dane|analizuj|analiza|tabela)/.test(t)) return ["DOCUMENT_ANALYSIS", "Document Intelligence", "ANALYSIS"];
  if (/(czarno[- ]?biał|czarno[- ]?bial|black and white|black & white|grayscale|greyscale|odbarw|desatur)/.test(t)) return ["IMAGE_EDIT", "Image Editing", "CREATIVE"];
  if (/(fotograf|zdję|obraz|image|png|jpg|jpeg|retusz|popraw)/.test(t)) return ["IMAGE_TASK", "Creative / Image Capability", "CREATIVE"];
  if (/(stronę|strona www|website|landing|witryn)/.test(t)) return ["WEB_BUILD", "Web Build", "BUILD"];
  if (/(aplikac|app|system|program|dashboard|narzędzi)/.test(t)) return ["APP_BUILD", "Application Build", "BUILD"];
  if (/(research|zbadaj|wyszukaj|sprawdź|konkurenc|rynek|ofert)/.test(t)) return ["RESEARCH", "Research & Web Intelligence", "RESEARCH"];
  if (/(plan|strateg|marketing|sprzedaż|proces|workflow|automatyz)/.test(t)) return ["OPERATIONS_PLAN", "Operations & Growth", "OPERATIONS"];
  return ["GENERAL_AGENT", "Core Intelligence", "INTELLIGENCE"];
}

function buildTaskAnswer(intent: string, task: string, documentContext = "") {
  const lower = task.toLowerCase();
  if (intent === "OPERATIONS_PLAN") {
    const isMarketing = /marketing|promoc|sprzedaż|sprzedaz|social|kampani/.test(lower);
    if (isMarketing) {
      return [
        "REKOMENDOWANY PLAN 90-DNIOWY",
        "",
        "Cel: zbudować powtarzalny lejek pozyskania klientów, zwiększyć konwersję i mierzyć wynik na poziomie przychodu, nie samego zasięgu.",
        "",
        "DNI 1-30 · FUNDAMENTY",
        "• Zdefiniuj 2-3 segmenty klientów i jedną główną ofertę dla każdego segmentu.",
        "• Uporządkuj Google Business Profile, stronę docelową, CTA, formularz/kontakt i tracking.",
        "• Przygotuj 3 filary komunikacji: oferta, dowód społeczny, edukacja.",
        "• Uruchom test 2 wariantów komunikatu i 2 CTA.",
        "KPI: liczba leadów, koszt leada, CTR, konwersja landing page, udział ruchu organicznego.",
        "",
        "DNI 31-60 · AKWIZYCJA",
        "• Skaluj tylko kanały z potwierdzonym kosztem pozyskania.",
        "• Uruchom remarketing do osób, które odwiedziły ofertę lub rozpoczęły kontakt.",
        "• Wprowadź tygodniowy eksperyment: jedna hipoteza → jedna zmiana → jeden pomiar.",
        "KPI: CPL/CPA, liczba kwalifikowanych leadów, konwersja lead→klient, przychód z kanału.",
        "",
        "DNI 61-90 · SKALOWANIE",
        "• Przenieś budżet do 20% najlepiej działających kampanii/ofert.",
        "• Zbuduj prosty dashboard tygodniowy: spend → lead → sprzedaż → przychód → ROI.",
        "• Usuń kanały bez dowodu ekonomicznego po ustalonym okresie testowym.",
        "KPI: CAC, przychód, marża, ROI/ROAS, retencja lub ponowny zakup.",
        "",
        "PRIORYTET 1: pomiar i oferta. PRIORYTET 2: konwersja. PRIORYTET 3: skalowanie.",
        "Najważniejsza zasada: nie zwiększać budżetu przed potwierdzeniem jakości ruchu i ekonomiki pozyskania."
      ].join("\n");
    }
  }
  if (intent === "WEB_BUILD") {
    return [
      "WEB BUILD · WERSJA ROBOCZA",
      "",
      "1. STRUKTURA: Home → Oferta/Menu → O nas → Opinie/Dowody → Kontakt/Rezerwacja.",
      "2. HERO: jeden główny komunikat wartości + główne CTA + drugorzędne CTA.",
      "3. KONWERSJA: formularz/rezerwacja, telefon, mapa, godziny i informacje wymagane przed kontaktem.",
      "4. UX: mobile-first, szybkie ładowanie, czytelna hierarchia, WCAG 2.2 AA, brak niepotrzebnych kroków.",
      "5. SEO: title/meta, H1-H3, dane lokalne, schema, treści odpowiadające intencji wyszukiwania.",
      "6. QA: mobile/desktop, formularze, linki, 404, performance, accessibility i podstawowe SEO.",
      "",
      "Kryterium gotowości: użytkownik w mniej niż 10 sekund rozumie ofertę i wie, co zrobić dalej."
    ].join("\n");
  }
  if (intent === "APP_BUILD") {
    return [
      "APP BUILD · MVP BLUEPRINT",
      "",
      "MVP: dashboard, kalendarz/workflow, rekordy użytkowników, statusy, wyszukiwanie, KPI i audit trail.",
      "Role: ADMIN → MANAGER → OPERATOR. Każda zmiana stanu powinna mieć autora i timestamp.",
      "Model danych: users, customers, items/records, activities, status_history, approvals, outcomes.",
      "Workflow: INPUT → VALIDATION → DECISION → APPROVAL (jeśli ryzyko) → EXECUTION → VERIFICATION → OUTCOME.",
      "KPI: aktywne sprawy, czas realizacji, completion rate, błędy, SLA i wynik biznesowy.",
      "Definition of Done: główny workflow działa end-to-end, błędy są obsłużone, uprawnienia działają, a krytyczne zdarzenia są audytowalne."
    ].join("\n");
  }
  if (intent === "DOCUMENT_ANALYSIS") {
    return documentContext
      ? [
          "ANALIZA DOKUMENTU · WYNIK ROBOCZY",
          "",
          "Materiał został przekazany do analizy. Wynik należy oprzeć na faktycznie wyodrębnionym tekście, a nie na założeniach.",
          "Najpierw: fakty i liczby. Następnie: ryzyka, anomalie, terminy/zobowiązania, braki danych i rekomendacje.",
          "Priorytet ryzyka: IMPACT × LIKELIHOOD. Każda rekomendacja powinna mieć właściciela, termin i kryterium zamknięcia.",
          "",
          "Dalszy krok: wynik może zostać zapisany jako raport wykonawczy po pełnym odczycie materiału."
        ].join("\n")
      : "Do pełnej analizy potrzebuję faktycznego pliku. Po jego dodaniu wynik będzie oparty na zawartości dokumentu, a nie na domysłach.";
  }
  if (intent === "DATA_VISUALIZATION") {
    return [
      "DATA ANALYSIS · DASHBOARD SPEC",
      "",
      "Najpierw walidacja: typy danych, braki, duplikaty, zakres dat i wartości odstające.",
      "KPI: wybierz 5-8 miar bezpośrednio związanych z decyzją biznesową.",
      "Widoki: KPI cards → trend w czasie → segmentacja → anomalie → tabela drill-down.",
      "Wnioski powinny odpowiadać na trzy pytania: co się zmieniło, dlaczego prawdopodobnie się zmieniło, co należy zrobić.",
      "Nie traktuj korelacji jako przyczynowości bez dodatkowego dowodu."
    ].join("\n");
  }
  if (intent === "RESEARCH") {
    return [
      "RESEARCH · EVIDENCE-FIRST BRIEF",
      "",
      "Pytanie główne: " + task,
      "1. Zdefiniuj hipotezy i kryteria decyzji.",
      "2. Zbierz źródła pierwotne oraz wiarygodne źródła wtórne.",
      "3. Dla każdej tezy zapisz źródło, datę, dowód i poziom pewności.",
      "4. Oddziel fakty od interpretacji i wskaż sprzeczne dane.",
      "5. Zakończ rekomendacją: CONTINUE / TEST / REJECT oraz najważniejszym następnym krokiem.",
      "",
      "Ten tryb nie powinien udawać aktualnego researchu bez dostępu do źródeł web w runtime."
    ].join("\n");
  }
  if (intent === "DOCUMENT_CREATE") {
    return [
      "DOCUMENT PACKAGE · DRAFT",
      "",
      "Struktura: Executive Summary → Problem/Cel → Analiza → Rekomendacje → Plan działania → KPI → Ryzyka → Załączniki.",
      "Każda sekcja powinna mieć jasny cel i odbiorcę. Liczby i twierdzenia wymagające dowodu należy oznaczyć jako wymagające weryfikacji.",
      "Format wyjściowy: dokument gotowy do eksportu po akceptacji treści i danych."
    ].join("\n");
  }
  return [
    "CORE ENGINE · KONKRETNY OUTPUT",
    "",
    "Zadanie: " + task,
    "",
    "Cel operacyjny: zamienić polecenie na mierzalny rezultat, a nie tylko opis procesu.",
    "Plan: zrozumienie intencji → dobór capability → wykonanie kontrolowane → weryfikacja → outcome.",
    "Kryterium jakości: rezultat musi być użyteczny bez konieczności ponownego interpretowania polecenia.",
    "Następny krok: przejście do właściwej capability i przygotowanie wyniku końcowego."
  ].join("\n");
}

function buildExecutionState(intent: string, needsAttachment: boolean) {
  return {
    phase: needsAttachment ? "INPUT_REQUIRED" : "RESULT_READY",
    stages: needsAttachment
      ? [
          { stage: "RECEIVED", status: "COMPLETE" },
          { stage: "UNDERSTAND", status: "COMPLETE" },
          { stage: "AUTH_CHECK", status: "NOT_REQUIRED_CONTINUE" },
          { stage: "INPUT_GATE", status: "WAITING_FOR_INPUT" }
        ]
      : [
          { stage: "RECEIVED", status: "COMPLETE" },
          { stage: "UNDERSTAND", status: "COMPLETE" },
          { stage: "AUTH_CHECK", status: "NOT_REQUIRED_CONTINUE" },
          { stage: "CAPABILITY", status: "SELECTED" },
          { stage: "PLAN", status: "READY" },
          { stage: "ANALYSIS", status: "COMPLETE" },
          { stage: "VERIFICATION", status: "PENDING_EXTERNAL_EXECUTION" },
          { stage: "OUTCOME", status: "RESULT_READY" }
        ],
    authentication: {
      required: false,
      status: "NOT_REQUIRED",
      terminal: false,
      meaning: "Authentication is not required for this analysis request; continue execution."
    },
    externalSideEffects: "BLOCKED_UNTIL_APPROVED"
  };
}

function buildDemoPreview(intent: string, task: string, documentContext = "") {
  const source = documentContext ? "materiał dostarczony przez użytkownika" : "opis zadania użytkownika";
  const common = {
    source,
    quality: "WORKING_RESULT",
    verified: false,
    disclaimer: "Wynik analityczny jest gotowy. Nie oznacza automatycznego wykonania działania zewnętrznego; działania z efektem zewnętrznym pozostają za bramką akceptacji."
  };
  if (intent === "DATA_VISUALIZATION") return { ...common, title: "Interactive data visualization", summary: "Dane zostałyby zamienione w czytelny dashboard KPI z trendami, anomaliami i wnioskami.", highlights: ["KPI i trendy", "Wykresy dopasowane do danych", "Anomalie", "Executive summary"], deliverable: "Dashboard + insight brief" };
  if (intent === "DOCUMENT_TRANSFORM") return { ...common, title: "File transformation", summary: "Materiał zostałby przekształcony do wskazanego formatu z zachowaniem struktury i kontroli jakości.", highlights: ["Ekstrakcja danych", "Transformacja formatu", "Normalizacja", "QA wyniku"], deliverable: "Transformed file + QA" };
  if (intent === "IMAGE_TO_VIDEO") return { ...common, title: "Image-to-video concept", summary: "Obraz zostałby przygotowany do animacji z ruchem kamery, warstwami ruchu i określonym stylem.", highlights: ["Motion direction", "Camera movement", "Atmosphere", "Output format"], deliverable: "Video generation brief" };
  if (intent === "IMAGE_CREATE") return { ...common, title: "Image generation", summary: "Core Engine przygotowałby prompt produkcyjny i parametry obrazu zgodne z celem użytkownika.", highlights: ["Composition", "Style", "Lighting", "Output format"], deliverable: "Image generation brief" };
  if (intent === "IMAGE_EDIT") return { ...common, title: "Image editing", summary: "Core Engine określiłby operacje edycji bez zmiany elementów, które użytkownik chce zachować.", highlights: ["Subject preservation", "Edit operations", "Style control", "Final QA"], deliverable: "Image edit plan" };
  if (intent === "DOCUMENT_ANALYSIS") return { ...common, title: "Executive document analysis", summary: "Dokument zostałby uporządkowany do warstwy faktów, ryzyk, anomalii i rekomendacji.", highlights: ["Fakty i liczby", "Ryzyka / terminy / zobowiązania", "Anomalie i braki danych", "Rekomendacje z priorytetem"], deliverable: "Raport analityczny + tabela ryzyk" };
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
  return { reply, intent, confidence: intent === "GENERAL_AGENT" ? 0.72 : 0.94, plan, requiresApproval: !needsAttachment, execution: "HUMAN_APPROVAL_REQUIRED", needsAttachment, capability, preview: { ...buildDemoPreview(intent, task, documentContext), answer: buildTaskAnswer(intent, task, documentContext) }, executionState: buildExecutionState(intent, needsAttachment), evidence: buildEvidencePreview(task, attachments, documentContext), successCriteria: ["Plan odpowiada intencji użytkownika", "Wymagane dane wejściowe są jawne", "Ryzyko i approval gate są widoczne", "Rezultat jest weryfikowalny przed użyciem"] };
}

async function generateAgentResponse(task: string, attachments: AgentAttachment[], documentContext = "", imageData = "") {
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
    const resolvedIntent = String(parsed.intent || "GENERAL_AGENT");
    const resolvedNeedsAttachment = Boolean(parsed.needsAttachment);
    return { reply: String(parsed.reply), intent: resolvedIntent, confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.8)), plan: parsed.plan.map(String).slice(0, 5), requiresApproval: parsed.requiresApproval !== false, execution: "HUMAN_APPROVAL_REQUIRED", capability: String(parsed.capability || "Core Intelligence"), needsAttachment: resolvedNeedsAttachment, preview: { ...buildDemoPreview(resolvedIntent, task, documentContext), answer: buildTaskAnswer(resolvedIntent, task, documentContext) }, executionState: buildExecutionState(resolvedIntent, resolvedNeedsAttachment), evidence: buildEvidencePreview(task, attachments, documentContext), successCriteria: ["Plan odpowiada intencji użytkownika", "Wymagane dane wejściowe są jawne", "Ryzyko i approval gate są widoczne", "Rezultat jest weryfikowalny przed użyciem"] };
  } catch {
    return fallbackAgent(task, attachments);
  } finally { clearTimeout(timeout); }
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 8 * 1024 * 1024) return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413 });
    const body = raw ? JSON.parse(raw) : {};
    const task = typeof body.task === "string" ? body.task.trim() : "";
    if (!task) return NextResponse.json({ ok: false, error: "TASK_REQUIRED" }, { status: 400 });
    if (task.length > MAX_TASK) return NextResponse.json({ ok: false, error: "TASK_TOO_LONG" }, { status: 400 });
    const documentContext = typeof body.documentContext === "string" ? body.documentContext.slice(0, 50000) : "";
    const imageDatas = Array.isArray(body.imageDatas) ? body.imageDatas.filter((x: unknown): x is string => typeof x === "string" && x.startsWith("data:image/")).slice(0, 6) : [];
    const attachments = (Array.isArray(body.attachments) ? body.attachments : []).slice(0, 6).map((x: AgentAttachment) => ({ name: String(x.name || "").slice(0, 180), type: String(x.type || "application/octet-stream").slice(0, 120), size: Math.max(0, Math.min(Number(x.size) || 0, 50000000)) })).filter((x: AgentAttachment) => x.name);
    const primaryImageData = imageDatas[0] || (typeof body.imageData === "string" ? body.imageData : "");
    let result = await generateAgentResponse(task, attachments, documentContext, primaryImageData);
    const imageData = primaryImageData;
    let artifact: AgentArtifact | undefined;
    try {
      const routed = await executeRoutedMultiTask(task, { imageData, imageDatas, text: documentContext });
      if (routed.artifact?.status === "EXECUTED") artifact = routed.artifact as AgentArtifact;
      if (artifact) {
        result = { ...result, preview: { ...result.preview, title: artifact.title, summary: "Core Engine dobrał właściwy MultiTask capability i zwrócił gotowy artefakt wynikowy." } };
      }
    } catch {}
    return NextResponse.json({ ok: true, ...result, artifact, control: { actor: "HUMAN", gate: "APPROVAL_REQUIRED", sideEffects: "BLOCKED_UNTIL_APPROVED", audit: true, authentication: result.executionState.authentication } });
  } catch {
    return NextResponse.json({ ok: false, error: "AGENT_REQUEST_INVALID" }, { status: 400 });
  }
}
