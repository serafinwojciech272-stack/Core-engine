"use client";

import "./tender.css";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight, CheckCircle2, CircleAlert, FileText, Gauge, Layers3,
  ShieldAlert, Sparkles, Target, Zap, ChevronRight, Search, Scale,
  Calculator, ClipboardCheck, MapPinned, Coins, Truck, BadgeCheck,
  CircleDollarSign, Workflow, HelpCircle
} from "lucide-react";
import {
  documents, questions, requirements, tenderFacts, type Priority,
  analysisStages, fccEvidence, strategicChecks
} from "@/app/tender-intelligence/zabrze/data";

const tabs = [
  "Podsumowanie",
  "Analiza krok po kroku",
  "Pytania do zamawiającego",
  "Dlaczego FCC?",
  "Wymagania",
  "Dokumenty",
] as const;
type Tab = typeof tabs[number];

const statusLabel = {
  CONFIRMED: "Potwierdzone",
  PARTIAL: "Częściowo potwierdzone",
  REQUIRES_VERIFICATION: "Do weryfikacji",
} as const;

const statusClass = {
  CONFIRMED: "confirmed",
  PARTIAL: "partial",
  REQUIRES_VERIFICATION: "verification",
} as const;

const gates = [
  ["01", "CZY MOŻEMY TO POLICZYĆ?", "Wolumeny, jednostki, trasy, częstotliwości i zakres."],
  ["02", "CZY MOŻEMY TO WYKONAĆ?", "Flota, ludzie, instalacje, PSZOK, routing i moce."],
  ["03", "CZY MOŻEMY OBRONIĆ CENĘ?", "Recykling, kary, waloryzacja, opcje i koszt ryzyka."],
  ["04", "CZY MOŻEMY ZŁOŻYĆ OFERTĘ?", "SWZ, JEDZ, wadium, podpisy, platforma i terminy."],
];

export default function TenderIntelligence() {
  const [tab, setTab] = useState<Tab>("Podsumowanie");
  const [priority, setPriority] = useState<Priority | "ALL">("ALL");
  const [expanded, setExpanded] = useState<string | null>("Q-P1-01");
  const filtered = useMemo(
    () => priority === "ALL" ? questions : questions.filter(q => q.priority === priority),
    [priority]
  );
  const confirmed = requirements.filter(r => r.status === "CONFIRMED").length;
  const partial = requirements.filter(r => r.status === "PARTIAL").length;
  const verify = requirements.filter(r => r.status === "REQUIRES_VERIFICATION").length;

  return (
    <main className="tender-shell">
      <header className="tender-nav">
        <Link href="/" className="ti-brand">
          <span className="ti-orb"><Sparkles size={16} /></span>
          <span>CORE ENGINE <i>/ ANALIZA PRZETARGU</i></span>
        </Link>
        <div className="ti-navmeta"><span className="live-dot" /> Z154/68879 · ANALIZA W TOKU</div>
        <Link className="backlink" href="/">Core Engine <ArrowUpRight size={14} /></Link>
      </header>

      <section className="tender-hero">
        <div className="hero-copy">
          <div className="ti-eyebrow"><span /> ANALIZA PO STRONIE WYKONAWCY · ZABRZE</div>
          <h1>Najpierw<br /><em>dowody. Potem decyzja.</em></h1>
          <p>
            Nie zaczynamy od ceny. Najpierw odtwarzamy zakres, wolumeny, operacje,
            ryzyko kontraktowe i mechanikę punktacji. Dopiero potem budujemy pytania,
            warianty cenowe i decyzję ofertową.
          </p>
          <div className="hero-actions">
            <button onClick={() => setTab("Analiza krok po kroku")}><Workflow size={15} /> Przejdź przez analizę</button>
            <button onClick={() => setTab("Dlaczego FCC?")}><Target size={15} /> Sprawdź hipotezę FCC</button>
            <a href={tenderFacts.sourceUrl} target="_blank" rel="noreferrer">Otwórz źródło <ArrowUpRight size={14} /></a>
          </div>
        </div>

        <div className="case-card">
          <div className="case-top">
            <span className="case-label">AKTYWNE POSTĘPOWANIE</span>
            <span className="case-state">ANALIZA W TOKU</span>
          </div>
          <h2>Odbiór i zagospodarowanie odpadów</h2>
          <p>{tenderFacts.reference} · {tenderFacts.cpv}</p>
          <div className="case-grid">
            <div><small>TERMIN SKŁADANIA</small><b>12.10.2026 · 09:00</b></div>
            <div><small>WADIUM</small><b>4 000 000 PLN</b></div>
            <div><small>OKRES</small><b>36 MIESIĘCY</b></div>
            <div><small>KRYTERIA</small><b>CENA 70% · RECYKLING 30%</b></div>
          </div>
          <div className="confidence">
            <span>Pokrycie macierzy wymagań</span>
            <b>{confirmed} potwierdzonych</b>
            <i>{partial} częściowo · {verify} wymagają dokumentów źródłowych</i>
          </div>
        </div>
      </section>

      <section className="ti-dashboard">
        <div className="analyst-banner">
          <div className="analyst-icon"><Search size={18} /></div>
          <div>
            <strong>Tryb: analityk przetargowy po stronie wykonawcy</strong>
            <span>Źródło → wymaganie → sprzeczność → koszt → ryzyko → pytanie → decyzja</span>
          </div>
          <span className="human-review">DECYZJA CZŁOWIEKA</span>
        </div>

        <div className="signal-strip">
          <div><span>ZAMAWIAJĄCY</span><b>Miasto Zabrze</b></div>
          <div><span>SKŁADANIE OFERT</span><b>12.10.2026 · 09:00</b></div>
          <div><span>WADIUM</span><b>4 000 000 PLN</b></div>
          <div><span>OCENA</span><b>70% cena · 30% recykling</b></div>
        </div>

        <nav className="ti-tabs">
          {tabs.map(t => <button key={t} onClick={() => setTab(t)} className={tab === t ? "active" : ""}>{t}</button>)}
        </nav>

        {tab === "Podsumowanie" && (
          <div className="exec-grid">
            <article className="intel-card main-brief">
              <div className="card-kicker"><Gauge size={14} /> DECYZJA ANALITYCZNA — STAN OBECNY</div>
              <h2>Największy błąd byłby prosty: policzyć cenę zanim wiemy, co naprawdę trzeba policzyć.</h2>
              <p>
                Ogłoszenie potwierdza ramy postępowania, ale ekonomika kontraktu jest w dokumentach
                szczegółowych. Core Engine powinien więc prowadzić użytkownika przez kolejne bramki,
                zamiast produkować jedną pozornie precyzyjną ocenę.
              </p>
              <div className="brief-lines">
                <div><CheckCircle2 /> <span>Potwierdzone: termin, wadium, 36 miesięcy, kryteria i podstawowy zakres.</span></div>
                <div><CircleAlert /> <span>Do odczytu: pełny OPZ, PPU, XLS, elektromobilność i ZIP.</span></div>
                <div><ShieldAlert /> <span>P1: wolumeny, jednostki, recykling, start realizacji, flota i opcje.</span></div>
              </div>
            </article>

            <article className="intel-card">
              <div className="card-kicker"><Target size={14} /> BRAMKI DECYZYJNE</div>
              {gates.map(x => (
                <div className="gate" key={x[0]}>
                  <b>{x[0]}</b><div><strong>{x[1]}</strong><small>{x[2]}</small></div>
                </div>
              ))}
            </article>

            <article className="intel-card wide">
              <div className="card-kicker"><Layers3 size={14} /> MAPA DOWODÓW</div>
              <div className="heatmap">
                <div className="heat green"><b>{confirmed}</b><span>potwierdzone</span></div>
                <div className="heat amber"><b>{partial}</b><span>częściowe</span></div>
                <div className="heat red"><b>{verify}</b><span>do weryfikacji</span></div>
                <div className="heat violet"><b>{questions.filter(q => q.priority === "P1").length}</b><span>pytania P1</span></div>
              </div>
            </article>

            <article className="intel-card wide strategy-callout">
              <div className="card-kicker"><CircleDollarSign size={14} /> HIPOTEZA STRATEGICZNA</div>
              <h3>FCC ma lokalne przesłanki operacyjne, ale trzeba je przeliczyć na przewagę ekonomiczną.</h3>
              <p>
                FCC Śląsk ma bazę w Zabrzu i prowadzi tam PSZOK. To może ograniczać mobilizację,
                logistykę i koszt startu — ale tylko wtedy, gdy wymagania tego postępowania
                rzeczywiście pokrywają się z istniejącymi zasobami. Model musi to udowodnić.
              </p>
              <button onClick={() => setTab("Dlaczego FCC?")}>Otwórz analizę FCC <ChevronRight size={15} /></button>
            </article>

            <article className="intel-card wide">
              <div className="card-kicker"><Sparkles size={14} /> NASTĘPNY RUCH SILNIKA</div>
              <div className="next-stage">
                <div>
                  <small>ETAP 01 → 07</small>
                  <h3>Najpierw komplet dokumentów. Następnie model kosztowy i dopiero wtedy decyzja ofertowa.</h3>
                  <p>Każdy brak ma zostać zamieniony w pytanie, a każde pytanie w potencjalny wpływ na cenę, ryzyko albo formalną możliwość złożenia oferty.</p>
                </div>
                <button onClick={() => setTab("Analiza krok po kroku")}>Uruchom sekwencję <ChevronRight size={15} /></button>
              </div>
            </article>
          </div>
        )}

        {tab === "Analiza krok po kroku" && (
          <div className="analysis-board">
            <div className="analysis-head">
              <div>
                <span className="card-kicker"><Workflow size={14} /> SEKWENCJA ANALITYCZNA</span>
                <h2>Co trzeba wyjaśnić — dokładnie w tej kolejności.</h2>
                <p>Nie przeskakujemy do ceny, dopóki wcześniejsza warstwa nie ma wystarczającego dowodu.</p>
              </div>
              <div className="analysis-rule"><Scale size={15} /><span>Brak dowodu → pytanie<br />Pytanie → wpływ na koszt<br />Wpływ → decyzja</span></div>
            </div>
            <div className="stage-list">
              {analysisStages.map((s, i) => (
                <article className="stage-card" key={s.id}>
                  <div className="stage-index">{s.id}</div>
                  <div className="stage-main">
                    <div className="stage-title"><h3>{s.title}</h3><span>{i < 4 ? "KRYTYCZNY" : "KONTROLNY"}</span></div>
                    <p>{s.why}</p>
                    <div className="stage-grid">
                      <div><small>DOWÓD</small><b>{s.evidence}</b></div>
                      <div><small>PYTANIE KONTROLNE</small><b>{s.question}</b></div>
                      <div><small>WPŁYW</small><b>{s.impact}</b></div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="decision-ladder">
              <div><span>01</span><b>DOKUMENTY</b><small>co mówi źródło?</small></div>
              <ChevronRight />
              <div><span>02</span><b>SPÓJNOŚĆ</b><small>czy dokumenty mówią to samo?</small></div>
              <ChevronRight />
              <div><span>03</span><b>KOSZT</b><small>ile to naprawdę kosztuje?</small></div>
              <ChevronRight />
              <div><span>04</span><b>RYZYKO</b><small>co może pójść źle?</small></div>
              <ChevronRight />
              <div><span>05</span><b>DECYZJA</b><small>czy i na jakich założeniach ofertować?</small></div>
            </div>
          </div>
        )}

        {tab === "Pytania do zamawiającego" && (
          <div className="question-board">
            <aside className="q-sidebar">
              <div className="card-kicker"><ShieldAlert size={14} /> GATE PYTAŃ</div>
              <h2>Pytanie ma usuwać ryzyko, nie tylko brak informacji.</h2>
              <p>P1 blokuje bezpieczną kalkulację lub może zmienić decyzję. P2 ma istotny wpływ kosztowy. P3 porządkuje pozostałe niejasności.</p>
              <div className="q-filters">
                {(["ALL", "P1", "P2", "P3"] as const).map(p => (
                  <button className={priority === p ? "active" : ""} onClick={() => setPriority(p)} key={p}>
                    {p === "ALL" ? "WSZYSTKIE" : p}<span>{p === "ALL" ? questions.length : questions.filter(q => q.priority === p).length}</span>
                  </button>
                ))}
              </div>
              <div className="question-method">
                <small>KAŻDE PYTANIE MUSI PRZEJŚĆ</small>
                <span>Źródło → niejasność → wpływ na cenę → jednoznaczność → brak duplikatu</span>
              </div>
            </aside>
            <div className="q-list">
              {filtered.map(q => (
                <article className={"q-item " + q.priority.toLowerCase()} key={q.id}>
                  <button className="q-summary" onClick={() => setExpanded(expanded === q.id ? null : q.id)}>
                    <span className="priority">{q.priority}</span>
                    <div><small>{q.id} · {q.area}</small><h3>{q.issue}</h3></div>
                    <span className="q-impact">{q.pricingImpact}</span>
                  </button>
                  {expanded === q.id && (
                    <div className="q-detail">
                      <div><small>DLACZEGO TO WAŻNE</small><p>{q.rationale}</p></div>
                      <div><small>PROPONOWANE PYTANIE</small><blockquote>{q.question}</blockquote></div>
                      <div className="q-evidence"><small>DOWÓD / STATUS</small><span>{q.evidence}</span></div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}

        {tab === "Dlaczego FCC?" && (
          <div className="fcc-board">
            <div className="fcc-hero">
              <div>
                <span className="card-kicker"><Target size={14} /> ANALIZA KONKURENCYJNA · FCC</span>
                <h2>Dlaczego FCC może wygrać ten przetarg?</h2>
                <p>
                  Nie traktujemy tego jako faktu ani prognozy wyniku. Budujemy hipotezę:
                  jakie udokumentowane zasoby FCC mogą tworzyć przewagę, a następnie sprawdzamy,
                  czy przewaga rzeczywiście przekłada się na cenę, recykling i zdolność wykonania.
                </p>
              </div>
              <div className="fcc-hypothesis"><span>HIPOTEZA</span><b>LOKALNOŚĆ → MOBILIZACJA → KOSZT → CENA</b><small>Do potwierdzenia przez OPZ, PPU, XLS i model zasobów.</small></div>
            </div>

            <div className="fcc-evidence-grid">
              {fccEvidence.map((e, i) => (
                <article className={"fcc-card " + e.kind.toLowerCase()} key={e.title}>
                  <div className="fcc-card-top"><span>0{i + 1}</span><b>{e.kind}</b></div>
                  <h3>{e.title}</h3>
                  <p>{e.text}</p>
                  <small>{e.source}</small>
                </article>
              ))}
            </div>

            <div className="fcc-model">
              <div className="fcc-model-head">
                <span className="card-kicker"><Calculator size={14} /> MODEL PRZEWAGI</span>
                <h2>Nie pytamy „czy FCC jest duże?”. Pytamy „czy FCC ma niższy koszt ryzyka w tym konkretnym kontrakcie?”.</h2>
              </div>
              <div className="fcc-factors">
                {[
                  { Icon: MapPinned, title: "Lokalność", text: "Baza i infrastruktura w Zabrzu mogą ograniczyć mobilizację." },
                  { Icon: Truck, title: "Flota", text: "Sprawdzić dostępność pojazdów, rezerwy i elektromobilność." },
                  { Icon: Layers3, title: "Infrastruktura", text: "Sprawdzić moce, instalacje, PSZOK i ścieżkę zagospodarowania." },
                  { Icon: Coins, title: "Ekonomia", text: "Policzyć CAPEX + OPEX + koszt ryzyka vs punkty." },
                  { Icon: BadgeCheck, title: "Recykling", text: "Udowodnić zdolność osiągnięcia deklarowanego poziomu." },
                  { Icon: ShieldAlert, title: "Ryzyko", text: "Porównać kary, SLA i mobilizację z realnym zapleczem." },
                ].map(({ Icon, title, text }) => (
                  <div key={title}><Icon size={17}/><b>{title}</b><p>{text}</p></div>
                ))}
              </div>
            </div>

            <div className="fcc-checklist">
              <div><span className="card-kicker"><HelpCircle size={14} /> 8 PYTAŃ, KTÓRE MUSZĄ PAŚĆ WEWNĄTRZ FCC</span><h2>Przewaga musi być policzalna.</h2></div>
              <div className="check-grid">
                {strategicChecks.map((c, i) => <div key={c}><span>0{i + 1}</span><p>{c}</p></div>)}
              </div>
            </div>
          </div>
        )}

        {tab === "Wymagania" && (
          <div className="table-wrap">
            <div className="table-head">
              <div><span className="card-kicker"><FileText size={14} /> MACIERZ WYMAGAŃ</span><h2>Co wiemy, z czego to wynika i co może zmienić ofertę.</h2></div>
              <div className="legend"><span className="l-green">POTWIERDZONE</span><span className="l-amber">CZĘŚCIOWE</span><span className="l-red">DO WERYFIKACJI</span></div>
            </div>
            <div className="req-table">
              {requirements.map(r => (
                <div className="req-row" key={r.id}>
                  <span className="req-id">{r.id}</span>
                  <div><b>{r.area} · {r.requirement}</b><p>{r.evidence}</p></div>
                  <span className={"status " + statusClass[r.status]}>{statusLabel[r.status]}</span>
                  <div className="impact"><small>WPŁYW</small><span>{r.impact}</span></div>
                  <div className="action"><small>NASTĘPNE DZIAŁANIE</small><span>{r.action}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "Dokumenty" && (
          <div className="doc-board">
            <div className="doc-intro">
              <span className="card-kicker"><FileText size={14} /> KONTROLA DOKUMENTÓW</span>
              <h2>Źródło przed wnioskiem.</h2>
              <p>{tenderFacts.documentStatus}</p>
              <div className="doc-principle"><Scale size={16} /><span>Brak dowodu = brak potwierdzenia.</span></div>
              <div className="doc-principle"><ClipboardCheck size={16} /><span>Po odczycie: ekstrakcja → cross-check → wpływ na cenę → pytania.</span></div>
            </div>
            <div className="doc-list">
              {documents.map(d => (
                <div className="doc-row" key={d[0]}>
                  <span>{d[0]}</span><FileText size={16} />
                  <div><b>{d[1]}</b><small>{d[2]}</small></div>
                  <strong className={d[3]}>{d[3] === "readable" ? "ODCZYTANY" : d[3] === "listed" ? "WYKAZANY" : "DO WERYFIKACJI"}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="workflow-strip">
          {[
            { n: "01", label: "DOKUMENTY", Icon: FileText },
            { n: "02", label: "EKSTRAKCJA", Icon: Search },
            { n: "03", label: "SPÓJNOŚĆ", Icon: Scale },
            { n: "04", label: "KOSZT", Icon: Calculator },
            { n: "05", label: "PYTANIA", Icon: ShieldAlert },
            { n: "06", label: "DECYZJA", Icon: ClipboardCheck },
          ].map(({ n, label, Icon }, i) => (
            <div className="workflow-step" key={n}>
              <span>{n}</span><Icon size={14}/><b>{label}</b>{i < 5 && <ChevronRight size={12} className="workflow-arrow"/>}
            </div>
          ))}
        </div>
      </section>

      <footer className="ti-footer">
        <span>CORE ENGINE · ANALIZA PRZETARGU</span>
        <span>Dowód → zakres → koszt → ryzyko → pytanie → decyzja → misja</span>
        <span>2026</span>
      </footer>
    </main>
  );
}
