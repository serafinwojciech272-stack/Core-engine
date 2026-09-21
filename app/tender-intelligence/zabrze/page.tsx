"use client";

import "./tender.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight, CheckCircle2, CircleAlert, FileText, Gauge,
  Layers3, ShieldAlert, Sparkles, Target, Zap, ChevronRight,
  Search, Scale, Calculator, ClipboardCheck
} from "lucide-react";
import { documents, questions, requirements, tenderFacts, type Priority } from "@/app/tender-intelligence/zabrze/data";

const tabs = ["Podsumowanie", "Wymagania", "Pytania do zamawiającego", "Dokumenty"] as const;
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
  const [runtime, setRuntime] = useState<{
    mission?: { state?: string; execution_count?: number; kpi?: string };
    events?: Array<{ event_type:string; from_state?:string|null; to_state?:string|null; actor_type:string; created_at:string }>;
    learning?: { lesson?:string; quality?:string; delta?:number|null; delta_pct?:number|null };
    outcome?: { before:number; after:number; delta:number; deltaPct:number|null };
    executionClassification?: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/tender-intelligence/zabrze", { headers: { Accept: "application/json" } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error("runtime")))
      .then(setRuntime)
      .catch(() => setRuntime(null));
  }, []);

  return (
    <main className="tender-shell">
      <header className="tender-nav">
        <Link href="/" className="ti-brand">
          <span className="ti-orb"><Sparkles size={16} /></span>
          <span>CORE ENGINE <i>/ ANALIZA PRZETARGU</i></span>
        </Link>
        <div className="ti-navmeta"><span className="live-dot" /> SPRAWA Z154/68879 · ANALIZA</div>
        <Link className="backlink" href="/">Core Engine <ArrowUpRight size={14} /></Link>
      </header>

      <section className="tender-hero">
        <div className="hero-copy">
          <div className="ti-eyebrow"><span /> ANALIZA PO STRONIE WYKONAWCY · ZABRZE</div>
          <h1>Najpierw<br /><em>dowody. Potem decyzja.</em></h1>
          <p>
            Centrum analizy postępowania dla zespołu ofertowego. Core Engine czyta wymagania,
            łączy dokumenty, wykrywa sprzeczności i niejasności, ocenia wpływ na cenę
            oraz przygotowuje pytania do zamawiającego.
          </p>
          <div className="hero-actions">
            <button onClick={() => setTab("Pytania do zamawiającego")}><Zap size={15} /> Zobacz pytania P1/P2/P3</button>
            <a href={tenderFacts.sourceUrl} target="_blank" rel="noreferrer">Otwórz źródło postępowania <ArrowUpRight size={14} /></a>
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
            <span>Pokrycie analizą wymagań</span>
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
            <span>Źródło → wymaganie → ryzyko → wpływ na cenę → pytanie → decyzja</span>
          </div>
          <span className="human-review">DECYZJA CZŁOWIEKA</span>
        </div>

        <div className="signal-strip">
          <div><span>ZAMAWIAJĄCY</span><b>Miasto Zabrze</b></div>
          <div><span>SKŁADANIE OFERT</span><b>12.10.2026 · 09:00</b></div>
          <div><span>WADIUM</span><b>4 000 000 PLN</b></div>
          <div><span>PYTANIA</span><b>{questions.length} do przeglądu</b></div>
        </div>

        {runtime && (
          <section className="runtime-panel" aria-label="Rzeczywisty przebieg misji Core Engine">
            <div className="runtime-head">
              <div>
                <span className="card-kicker"><Zap size={14} /> RUNTIME · MISJA ZABRZE</span>
                <h2>Od rzeczywistego przypadku do decyzji, pomiaru i uczenia.</h2>
                <p>Stan jest odczytywany z trwałego zapisu Core Engine w Supabase. Wykonanie oznaczone jako E2E_ORCHESTRATED nie oznacza wysłania oferty ani wykonania zewnętrznej czynności przetargowej.</p>
              </div>
              <div className="runtime-state"><b>{runtime.mission?.state || "—"}</b><span>{runtime.executionClassification || "—"}</span></div>
            </div>
            <div className="runtime-flow">
              {(runtime.events || []).filter(e => e.event_type === "STATE_CHANGED" || e.event_type === "MISSION_CREATED").map((e,i) => (
                <div className="runtime-step" key={e.created_at+i}>
                  <small>{String(i+1).padStart(2,"0")}</small>
                  <b>{e.to_state || e.event_type}</b>
                  <span>{e.actor_type === "human" ? "człowiek" : "silnik"}</span>
                </div>
              ))}
            </div>
            <div className="runtime-metrics">
              <div><span>Wynik przed</span><b>{runtime.outcome?.before ?? "—"}</b></div>
              <div><span>Wynik po</span><b>{runtime.outcome?.after ?? "—"}</b></div>
              <div><span>Zmiana</span><b>{runtime.outcome ? "+" + runtime.outcome.delta : "—"}</b></div>
              <div><span>Uczenie</span><b>{runtime.learning?.quality || "—"}</b></div>
            </div>
            {runtime.learning?.lesson && <div className="runtime-learning"><span>LEKCJA Z WYNIKU</span><b>{runtime.learning.lesson}</b></div>}
          </section>
        )}

        <nav className="ti-tabs">
          {tabs.map(t => <button key={t} onClick={() => setTab(t)} className={tab === t ? "active" : ""}>{t}</button>)}
        </nav>

        {tab === "Podsumowanie" && (
          <div className="exec-grid">
            <article className="intel-card main-brief">
              <div className="card-kicker"><Gauge size={14} /> OCENA ANALITYCZNA</div>
              <h2>To nie jest tylko przetarg na cenę. To model kosztu, ryzyka i odpowiedzialności.</h2>
              <p>
                Ogłoszenie pozwala potwierdzić ramy postępowania: 36 miesięcy, wadium 4 mln PLN,
                cena 70% i poziom recyklingu 30%. Kluczowe dane do kalkulacji znajdują się jednak
                w SWZ, OPZ, PPU, arkuszu kalkulacji ceny i załącznikach OPZ.
              </p>
              <div className="brief-lines">
                <div><CheckCircle2 /> <span>Fakty z ogłoszenia zostały oddzielone od założeń.</span></div>
                <div><CircleAlert /> <span>Wymagania zależne od SWZ/OPZ/PPU/XLS pozostają oznaczone jako do weryfikacji.</span></div>
                <div><ShieldAlert /> <span>Poziom recyklingu może zmienić jednocześnie punktację, koszt i ryzyko kontraktowe.</span></div>
              </div>
            </article>

            <article className="intel-card">
              <div className="card-kicker"><Target size={14} /> BRAMKI DECYZYJNE</div>
              {[
                ["01", "CZY MOŻEMY TO POLICZYĆ?", "Wolumeny, jednostki, trasy i zakres"],
                ["02", "CZY MOŻEMY TO WYKONAĆ?", "Flota, ludzie, instalacje i logistyka"],
                ["03", "CZY MOŻEMY OBRONIĆ CENĘ?", "Recykling, kary, waloryzacja i opcje"],
                ["04", "CZY MOŻEMY ZŁOŻYĆ OFERTĘ?", "Dokumenty, podpisy, wadium i platforma"],
              ].map(x => (
                <div className="gate" key={x[0]}>
                  <b>{x[0]}</b><div><strong>{x[1]}</strong><small>{x[2]}</small></div>
                </div>
              ))}
            </article>

            <article className="intel-card wide">
              <div className="card-kicker"><Layers3 size={14} /> MAPA STANU DOWODÓW</div>
              <div className="heatmap">
                <div className="heat green"><b>{confirmed}</b><span>potwierdzone</span></div>
                <div className="heat amber"><b>{partial}</b><span>częściowe</span></div>
                <div className="heat red"><b>{verify}</b><span>do weryfikacji</span></div>
                <div className="heat violet"><b>{questions.filter(q => q.priority === "P1").length}</b><span>pytania P1</span></div>
              </div>
            </article>

            <article className="intel-card wide">
              <div className="card-kicker"><Sparkles size={14} /> NASTĘPNY KROK SILNIKA</div>
              <div className="next-stage">
                <div>
                  <small>ETAP ANALIZY · DOKUMENTY ŹRÓDŁOWE</small>
                  <h3>Najpierw odczytać komplet SWZ, OPZ, PPU, XLS i ZIP. Dopiero potem zamknąć analizę ceny.</h3>
                  <p>
                    System nie powinien przedstawiać nieodczytanego dokumentu jako dowodu.
                    Po pełnej ekstrakcji należy połączyć pozycje kalkulacji z wymaganiami OPZ i PPU,
                    wykryć sprzeczności, policzyć wpływ na koszt i zaktualizować pytania.
                  </p>
                </div>
                <button onClick={() => setTab("Dokumenty")}>Przejdź do dokumentów <ChevronRight size={15} /></button>
              </div>
            </article>
          </div>
        )}

        {tab === "Wymagania" && (
          <div className="table-wrap">
            <div className="table-head">
              <div>
                <span className="card-kicker"><FileText size={14} /> MACIERZ WYMAGAŃ</span>
                <h2>Co wiemy, z czego to wynika i co może zmienić ofertę.</h2>
              </div>
              <div className="legend">
                <span className="l-green">POTWIERDZONE</span>
                <span className="l-amber">CZĘŚCIOWE</span>
                <span className="l-red">DO WERYFIKACJI</span>
              </div>
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

        {tab === "Pytania do zamawiającego" && (
          <div className="question-board">
            <aside className="q-sidebar">
              <div className="card-kicker"><ShieldAlert size={14} /> PYTANIA DOPRECYZOWUJĄCE</div>
              <h2>Pytania wynikają z ryzyka, nie z ciekawości.</h2>
              <p>
                P1 blokuje bezpieczną kalkulację lub może zmienić decyzję. P2 ma istotny wpływ kosztowy.
                P3 porządkuje pozostałe niejasności.
              </p>
              <div className="q-filters">
                {(["ALL", "P1", "P2", "P3"] as const).map(p => (
                  <button className={priority === p ? "active" : ""} onClick={() => setPriority(p)} key={p}>
                    {p === "ALL" ? "WSZYSTKIE" : p}<span>{p === "ALL" ? questions.length : questions.filter(q => q.priority === p).length}</span>
                  </button>
                ))}
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
                      <div><small>PROPONOWANE PYTANIE DO ZAMAWIAJĄCEGO</small><blockquote>{q.question}</blockquote></div>
                      <div className="q-evidence"><small>DOWÓD / STATUS ŹRÓDŁA</small><span>{q.evidence}</span></div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}

        {tab === "Dokumenty" && (
          <div className="doc-board">
            <div className="doc-intro">
              <span className="card-kicker"><FileText size={14} /> KONTROLA DOKUMENTÓW</span>
              <h2>Źródło przed wnioskiem.</h2>
              <p>
                Każdy dokument ma jawny status. „Wykazany” nie oznacza „przeczytany”.
                Analiza cenowa może być zamknięta dopiero po odczycie materiału źródłowego.
              </p>
              <div className="doc-principle"><Scale size={16} /><span>Brak dowodu = brak potwierdzenia.</span></div>
            </div>
            <div className="doc-list">
              {documents.map(d => (
                <div className="doc-row" key={d[0]}>
                  <span>{d[0]}</span><FileText size={16} />
                  <div><b>{d[1]}</b><small>{d[2]}</small></div>
                  <strong className={d[3]}>
                    {d[3] === "readable" ? "ODCZYTANY" : d[3] === "listed" ? "WYKAZANY" : "DO WERYFIKACJI"}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="workflow-strip">
          {[
            { n: "01", label: "DOKUMENTY", Icon: FileText },
            { n: "02", label: "EKSTRAKCJA", Icon: Search },
            { n: "03", label: "KONTROLA SPÓJNOŚCI", Icon: Scale },
            { n: "04", label: "WPŁYW NA CENĘ", Icon: Calculator },
            { n: "05", label: "PYTANIA", Icon: ShieldAlert },
            { n: "06", label: "DECYZJA", Icon: ClipboardCheck },
          ].map(({ n, label, Icon }, i) => (
            <div className="workflow-step" key={n}>
              <span>{n}</span><Icon size={14} /><b>{label}</b>{i < 5 && <ChevronRight size={12} className="workflow-arrow" />}
            </div>
          ))}
        </div>
      </section>

      <footer className="ti-footer">
        <span>CORE ENGINE · ANALIZA PRZETARGU</span>
        <span>Dowód → ryzyko → cena → pytanie → decyzja → misja</span>
        <span>2026</span>
      </footer>
    </main>
  );
}
