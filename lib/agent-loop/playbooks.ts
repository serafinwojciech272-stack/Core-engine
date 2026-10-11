// Playbooks (ADR-003): curated, parameterised run templates. A playbook turns a few form fields into a
// precise goal + acceptance criteria + budget, so operators get reliable runs without prompt engineering.
// Rendering happens on the server: the client sends { playbookId, inputs } and cannot smuggle in criteria.
import type { Capability, RunBudget } from "@/lib/agent-loop/contracts";

export type PlaybookInput = {
  key: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
  required?: boolean;
  maxLength?: number;
};

export type Playbook = {
  id: string;
  title: string;
  tagline: string;
  category: "build" | "strategy" | "growth" | "data";
  /** Short glyph shown on the card (plain text, no icon font needed). */
  glyph: string;
  inputs: PlaybookInput[];
  goal: string;          // {{key}} placeholders are replaced by inputs
  criteria: string[];    // may contain placeholders too
  budget: Partial<Pick<RunBudget, "maxCostUsd" | "maxSteps">>;
  /** "optional": the run can execute code if the operator asks for a sandbox worker. */
  sandbox?: "optional";
  /** Input passed as run context instead of being inlined into the goal (large pasted data). */
  contextKey?: string;
};

export const PLAYBOOKS: readonly Playbook[] = [
  {
    id: "agent-blueprint",
    title: "Projekt agenta AI",
    tagline: "Specyfikacja gotowego agenta: rola, narzędzia, prompt, guardraile i testy.",
    category: "build",
    glyph: "AG",
    inputs: [
      { key: "name", label: "Nazwa agenta", placeholder: "np. Agent obsługi rezerwacji", required: true, maxLength: 120 },
      { key: "job", label: "Co ma robić (zadanie i dla kogo)", placeholder: "np. przyjmuje rezerwacje stolików z maili i Messengera, potwierdza, pilnuje limitu miejsc", multiline: true, required: true, maxLength: 2000 },
      { key: "systems", label: "Systemy i dane, do których ma dostęp", placeholder: "np. Google Calendar, arkusz stolików, Gmail", maxLength: 600 },
    ],
    goal: [
      "Zaprojektuj kompletnego agenta AI \"{{name}}\".",
      "Zadanie agenta: {{job}}",
      "Dostępne systemy i dane: {{systems}}",
      "Przygotuj w workspace:",
      "1. AGENT_SPEC.md — rola, zakres odpowiedzialności, czego agent NIE robi, przepływ krok po kroku, eskalacja do człowieka.",
      "2. tools.json — definicje narzędzi w formacie JSON Schema (name, description, parameters), z oznaczeniem akcji wymagających akceptacji człowieka.",
      "3. SYSTEM_PROMPT.md — gotowy prompt systemowy.",
      "4. evals.json — min. 8 przypadków testowych (wejście, oczekiwane zachowanie, kryterium oceny), w tym 3 przypadki brzegowe/ataki (prompt injection, brak danych, prośba poza zakresem).",
      "5. RISKS.md — ryzyka (bezpieczeństwo, koszty, błędy) i jak je ograniczyć.",
    ].join("\n"),
    criteria: [
      "AGENT_SPEC.md opisuje rolę, zakres, przepływ i eskalację",
      "tools.json zawiera poprawny JSON z definicjami narzędzi",
      "SYSTEM_PROMPT.md istnieje",
      "evals.json ma co najmniej 8 przypadków, w tym 3 brzegowe",
      "RISKS.md wymienia ryzyka z mitigacjami",
    ],
    budget: { maxCostUsd: 0.8, maxSteps: 30 },
  },
  {
    id: "ceo-plan",
    title: "CEO: plan wykonawczy",
    tagline: "Cel biznesowy → strumienie pracy, zespół agentów, KPI, ryzyka i plan na 30 dni.",
    category: "strategy",
    glyph: "CEO",
    inputs: [
      { key: "objective", label: "Cel biznesowy", placeholder: "np. 50 płacących klientów SaaS dla restauracji w 90 dni", required: true, maxLength: 600 },
      { key: "context", label: "Kontekst (zasoby, budżet, ograniczenia)", placeholder: "np. 1 osoba, 2000 zł/mies., produkt w wersji beta", multiline: true, maxLength: 3000 },
    ],
    goal: [
      "Działaj jako CEO zespołu agentów AI. Cel: {{objective}}",
      "Kontekst: {{context}}",
      "Rozłóż cel na 3–6 strumieni pracy. Dla każdego: właściciel (człowiek lub konkretny agent AI z opisem roli), rezultaty, KPI z wartością docelową, zależności.",
      "Zapisz w workspace: EXEC_PLAN.md (strumienie, kamienie milowe tydzień po tygodniu na 30 dni, ryzyka z mitigacją, decyzje do podjęcia przez człowieka) oraz AGENT_TEAM.md (lista agentów do zbudowania: rola, wejścia, wyjścia, narzędzia, kiedy eskalują).",
    ].join("\n"),
    criteria: [
      "EXEC_PLAN.md ma 3–6 strumieni z KPI i właścicielami",
      "EXEC_PLAN.md zawiera plan tydzień po tygodniu na 30 dni",
      "AGENT_TEAM.md opisuje role agentów i punkty eskalacji",
      "Ryzyka mają przypisane mitigacje",
    ],
    budget: { maxCostUsd: 0.6, maxSteps: 25 },
  },
  {
    id: "landing-page",
    title: "Landing page",
    tagline: "Kompletna strona sprzedażowa: copy, sekcje, responsywny HTML gotowy do publikacji.",
    category: "build",
    glyph: "WEB",
    inputs: [
      { key: "brand", label: "Marka / produkt", placeholder: "np. Studio Lila — salon fryzjerski w Krakowie", required: true, maxLength: 200 },
      { key: "offer", label: "Oferta i grupa docelowa", placeholder: "np. koloryzacja i strzyżenie dla kobiet 25–45, rezerwacja online, pakiety ślubne", multiline: true, required: true, maxLength: 2000 },
      { key: "cta", label: "Główne wezwanie do działania", placeholder: "np. Zarezerwuj wizytę", maxLength: 120 },
    ],
    goal: [
      "Zbuduj landing page dla: {{brand}}.",
      "Oferta i odbiorcy: {{offer}}",
      "Główne CTA: {{cta}}",
      "Najpierw napisz COPY.md (nagłówek, podtytuł, 3 korzyści, sekcja zaufania, FAQ 4 pytania, CTA), potem zbuduj stronę narzędziem website_build. Strona po polsku, responsywna, z wyraźnym CTA powyżej linii zgięcia.",
    ].join("\n"),
    criteria: [
      "COPY.md zawiera nagłówek, korzyści, FAQ i CTA",
      "site/index.html istnieje w workspace",
      "Strona zawiera CTA i sekcję FAQ",
    ],
    budget: { maxCostUsd: 0.8, maxSteps: 25 },
  },
  {
    id: "code-module",
    title: "Moduł z testami",
    tagline: "Kod + testy jednostkowe. Z lokalnym workerem agent sam uruchamia testy aż przejdą.",
    category: "build",
    glyph: "</>",
    inputs: [
      { key: "language", label: "Język", placeholder: "np. Python", required: true, maxLength: 40 },
      { key: "feature", label: "Co ma robić moduł", placeholder: "np. kalkulator faktur: pozycje, rabaty, VAT 23/8/5%, suma brutto, zaokrąglenia do grosza", multiline: true, required: true, maxLength: 3000 },
    ],
    goal: [
      "Napisz moduł w języku {{language}}: {{feature}}",
      "Wymagania: czytelny kod z typami, obsługa błędnych danych, min. 8 testów jednostkowych (w tym przypadki brzegowe), README.md z przykładem użycia.",
      "Jeśli masz narzędzie run_command: uruchom testy, napraw błędy i powtarzaj aż wszystkie przejdą.",
    ].join("\n"),
    criteria: [
      "Kod modułu jest w workspace",
      "Co najmniej 8 testów jednostkowych",
      "README.md z przykładem użycia",
    ],
    budget: { maxCostUsd: 1, maxSteps: 40 },
    sandbox: "optional",
  },
  {
    id: "data-insights",
    title: "Analiza danych",
    tagline: "Wklej dane (CSV) i pytanie — dostajesz liczby, wnioski i raport do pobrania.",
    category: "data",
    glyph: "Σ",
    inputs: [
      { key: "question", label: "Pytanie biznesowe", placeholder: "np. które dni i produkty spadają najmocniej i dlaczego?", required: true, maxLength: 600 },
      { key: "data", label: "Dane (CSV, z nagłówkiem)", placeholder: "data,produkt,sprzedaz\n2026-09-01,IPA,120\n…", multiline: true, required: true, maxLength: 40000 },
    ],
    goal: [
      "Odpowiedz na pytanie: {{question}}",
      "Przeanalizuj dane narzędziem data_analyze, podaj konkretne liczby (zmiany %, największe spadki/wzrosty), 3 hipotezy przyczyn i 3 rekomendacje działań.",
      "Zapisz INSIGHTS.md i utwórz raport narzędziem document_create (PDF). Dane są w sekcji CONTEXT.",
    ].join("\n"),
    criteria: [
      "INSIGHTS.md zawiera konkretne liczby z danych",
      "3 hipotezy i 3 rekomendacje",
      "Raport PDF jest w artefaktach",
    ],
    budget: { maxCostUsd: 0.6, maxSteps: 20 },
    contextKey: "data",
  },
  {
    id: "gastro-growth",
    title: "Gastro growth pack",
    tagline: "Pakiet marketingowy dla lokalu: opisy menu, posty, wizytówka Google, akcja na słabe dni.",
    category: "growth",
    glyph: "GG",
    inputs: [
      { key: "venue", label: "Lokal (nazwa, miasto, styl)", placeholder: "np. bistro we Wrocławiu, kuchnia sezonowa, 40 miejsc", required: true, maxLength: 300 },
      { key: "goal", label: "Cel na najbliższy miesiąc", placeholder: "np. więcej gości od poniedziałku do środy", required: true, maxLength: 400 },
      { key: "menu", label: "Kilka pozycji menu (opcjonalnie)", placeholder: "np. zupa dnia; risotto z dynią; sernik baskijski", multiline: true, maxLength: 3000 },
    ],
    goal: [
      "Przygotuj pakiet marketingowy dla lokalu: {{venue}}. Cel: {{goal}}.",
      "Menu (jeśli podano): {{menu}}",
      "W workspace: MENU_COPY.md (apetyczne opisy pozycji), SOCIAL.md (12 postów na 4 tygodnie: tekst, pora publikacji, pomysł na zdjęcie), GOOGLE_PROFILE.md (opis wizytówki + 5 odpowiedzi na typowe opinie), PROMO.md (2 akcje na słabe dni z prostą kalkulacją opłacalności).",
    ].join("\n"),
    criteria: [
      "SOCIAL.md zawiera 12 postów z porą publikacji",
      "GOOGLE_PROFILE.md z opisem i 5 odpowiedziami na opinie",
      "PROMO.md z 2 akcjami i kalkulacją opłacalności",
    ],
    budget: { maxCostUsd: 0.6, maxSteps: 20 },
  },
  {
    id: "outreach-campaign",
    title: "Kampania e-mail",
    tagline: "Sekwencja 3 maili do klientów B2B. Wysyłka zawsze czeka na Twoją akceptację.",
    category: "growth",
    glyph: "@",
    inputs: [
      { key: "product", label: "Produkt / usługa", placeholder: "np. sklep WooCommerce w 14 dni dla lokalnych firm", required: true, maxLength: 300 },
      { key: "audience", label: "Do kogo", placeholder: "np. właściciele restauracji bez sklepu online", required: true, maxLength: 300 },
    ],
    goal: [
      "Przygotuj sekwencję 3 maili B2B dla produktu: {{product}}. Odbiorcy: {{audience}}.",
      "Każdy mail: temat (≤ 60 znaków), treść ≤ 120 słów, jedno CTA, personalizacja. Zapisz EMAILS.md.",
      "Nie wysyłaj nic bez akceptacji człowieka. Jeśli wysyłka nie jest skonfigurowana, napisz to wprost.",
    ].join("\n"),
    criteria: [
      "EMAILS.md zawiera 3 maile z tematem, treścią i CTA",
      "Tematy mają maksymalnie 60 znaków",
    ],
    budget: { maxCostUsd: 0.4, maxSteps: 15 },
  },
  {
    id: "research-brief",
    title: "Brief rynkowy",
    tagline: "Szybki brief: konkurencja, ceny, luki na rynku i rekomendacja pozycjonowania.",
    category: "strategy",
    glyph: "BR",
    inputs: [
      { key: "market", label: "Rynek / nisza", placeholder: "np. agenci AI dla gastronomii w Polsce", required: true, maxLength: 300 },
      { key: "known", label: "Co już wiesz (opcjonalnie)", placeholder: "np. konkurenci, ceny, Twoja przewaga", multiline: true, maxLength: 4000 },
    ],
    goal: [
      "Przygotuj brief rynkowy dla niszy: {{market}}.",
      "Wiedza wejściowa: {{known}}",
      "Zapisz BRIEF.md: segmenty klientów, typowe problemy, mapa konkurencji (kategorie, jeśli nie znasz nazw — nie zmyślaj firm), modele cenowe, 3 luki rynkowe, rekomendowane pozycjonowanie i 5 pytań do zweryfikowania z klientami.",
      "Wyraźnie oznacz, co jest założeniem, a co wynika z danych wejściowych.",
    ].join("\n"),
    criteria: [
      "BRIEF.md zawiera segmenty, konkurencję, ceny i 3 luki",
      "Założenia są oznaczone jako założenia",
      "5 pytań do weryfikacji z klientami",
    ],
    budget: { maxCostUsd: 0.5, maxSteps: 15 },
  },
];

export function getPlaybook(id: string): Playbook | undefined {
  return PLAYBOOKS.find((p) => p.id === id);
}

/** Public catalog for the UI (templates stay server-side). */
export function playbookCatalog() {
  return PLAYBOOKS.map(({ id, title, tagline, category, glyph, inputs, budget, sandbox }) => ({ id, title, tagline, category, glyph, inputs, budget, sandbox: sandbox ?? null }));
}

export type RenderedPlaybook = { goal: string; context?: string; acceptanceCriteria: string[]; budget: Playbook["budget"]; requires: Capability[]; playbookId: string };

/**
 * Validates inputs and renders the playbook. Throws INVALID_PLAYBOOK / INVALID_PLAYBOOK_INPUT:<key>.
 * Unknown keys are ignored; empty optional fields become "(nie podano)" so the goal stays grammatical.
 */
export function renderPlaybook(id: string, inputs: unknown, options: { sandbox?: boolean } = {}): RenderedPlaybook {
  const playbook = getPlaybook(id);
  if (!playbook) throw new Error("INVALID_PLAYBOOK");
  const values = (inputs && typeof inputs === "object" ? inputs : {}) as Record<string, unknown>;
  const clean: Record<string, string> = {};
  for (const field of playbook.inputs) {
    const raw = typeof values[field.key] === "string" ? (values[field.key] as string).trim() : "";
    if (field.required && !raw) throw new Error("INVALID_PLAYBOOK_INPUT:" + field.key);
    if (raw.length > (field.maxLength ?? 2000)) throw new Error("INVALID_PLAYBOOK_INPUT:" + field.key);
    // Braces are stripped so user text can never introduce new placeholders.
    clean[field.key] = raw.replace(/[{}]/g, "") || "(nie podano)";
  }
  const fill = (template: string) => template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => clean[key] ?? "");
  return {
    goal: fill(playbook.goal),
    ...(playbook.contextKey && clean[playbook.contextKey] !== "(nie podano)" ? { context: clean[playbook.contextKey] } : {}),
    acceptanceCriteria: playbook.criteria.map(fill),
    budget: playbook.budget,
    requires: options.sandbox && playbook.sandbox ? ["sandbox"] : [],
    playbookId: playbook.id,
  };
}
