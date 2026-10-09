"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowLeft, ArrowUpRight, Bot, CheckCircle2, CircleAlert, Clock3, Cpu, Database, GitBranch, Layers3, RefreshCw, ShieldCheck, Sparkles, Workflow, Zap } from "lucide-react";

type RuntimePayload = {
  ok?: boolean;
  agent?: { name?: string; version?: string; [key: string]: unknown };
  runtime?: {
    status?: string;
    persistence?: string;
    durable?: boolean;
    readinessReasons?: string[];
    adapters?: unknown[];
    providerReadiness?: Record<string, unknown> | unknown[];
    capabilityPacks?: number;
    execution?: unknown;
    liveExternalSideEffects?: boolean;
    approvalRequiredForHighRiskActions?: boolean;
    commercialRuntime?: unknown;
    commercialReadiness?: unknown;
    saas?: unknown;
  };
  integration?: Record<string, string>;
};

function label(value: unknown, fallback = "Nieznane") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value ? "Tak" : "Nie";
  if (typeof value === "object") return Array.isArray(value) ? String(value.length) + " elementów" : "Dostępne";
  return String(value);
}

export default function RuntimePage() {
  const [data, setData] = useState<RuntimePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setError("");
    }
    try {
      const response = await fetch("/api/agent", { headers: { Accept: "application/json" }, cache: "no-store" });
      const body = await response.json() as RuntimePayload;
      if (!response.ok || !body.ok) throw new Error("Endpoint runtime zwrócił HTTP " + response.status);
      setData(body);
      setUpdatedAt(new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się odczytać statusu runtime.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(false); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const runtime = data?.runtime;
  const adapters = Array.isArray(runtime?.adapters) ? runtime.adapters : [];
  const providerEntries = runtime?.providerReadiness && typeof runtime.providerReadiness === "object"
    ? Object.entries(runtime.providerReadiness)
    : [];
  const health = data?.ok && runtime?.status === "READY";

  return (
    <main className="rt-page">
      <style jsx global>{`
        *{box-sizing:border-box}body{margin:0;background:#08090d;color:#eef0f7;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        a{color:inherit;text-decoration:none}button{font:inherit}.rt-page{min-height:100vh;background:radial-gradient(ellipse at 68% -15%,rgba(111,78,255,.19),transparent 43%),#08090d;color:#eef0f7}
        .rt-top{height:76px;border-bottom:1px solid #20222c;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(18px,5vw,72px);background:rgba(8,9,13,.82);position:sticky;top:0;z-index:4;backdrop-filter:blur(18px)}
        .rt-brand{display:flex;align-items:center;gap:12px;font-size:12px;letter-spacing:.16em;font-weight:850}.rt-logo{height:34px;width:34px;border:1px solid #494064;background:#171323;color:#bca6ff;border-radius:11px;display:grid;place-items:center}
        .rt-top-actions{display:flex;align-items:center;gap:10px}.rt-link,.rt-refresh{border:1px solid #30313d;background:#11131a;color:#c8cad5;border-radius:9px;padding:10px 13px;display:inline-flex;align-items:center;gap:8px;font-size:12px;cursor:pointer}.rt-refresh:disabled{opacity:.55}
        .rt-wrap{max-width:1380px;margin:0 auto;padding:46px clamp(18px,5vw,72px) 72px}.rt-eyebrow{display:flex;align-items:center;gap:9px;color:#a997e7;font-size:10px;font-weight:800;letter-spacing:.2em;text-transform:uppercase}.rt-pulse{height:7px;width:7px;border-radius:50%;background:#8d79ff;box-shadow:0 0 14px #8d79ff}
        .rt-title-row{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin:18px 0 30px}.rt-title-row h1{font-size:clamp(34px,5vw,60px);letter-spacing:-.06em;line-height:1.02;margin:0}.rt-title-row h1 span{color:#a88cff}.rt-title-row p{color:#9698a8;line-height:1.65;max-width:670px;font-size:14px;margin:14px 0 0}.rt-health{border:1px solid #29483e;background:#0e1c19;color:#8ce0ba;border-radius:11px;padding:12px 14px;display:flex;align-items:center;gap:9px;white-space:nowrap;font-size:11px;font-weight:800;letter-spacing:.08em}
        .rt-error{padding:14px 16px;border:1px solid #673b3b;background:#251313;color:#ffb8b8;border-radius:12px;margin:0 0 18px;font-size:13px}.rt-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.rt-card{border:1px solid #262936;background:linear-gradient(145deg,rgba(21,23,32,.96),rgba(13,14,20,.96));border-radius:15px;padding:19px;min-width:0}.rt-card-top{display:flex;justify-content:space-between;align-items:center;color:#a1a4b4;font-size:11px;letter-spacing:.09em;text-transform:uppercase}.rt-icon{height:34px;width:34px;border:1px solid #343342;background:#191722;color:#b9a2ff;border-radius:10px;display:grid;place-items:center}.rt-value{font-size:clamp(22px,2.7vw,34px);letter-spacing:-.045em;font-weight:760;margin:17px 0 5px;overflow-wrap:anywhere}.rt-note{font-size:11px;color:#7f8291;line-height:1.5}.rt-section-head{display:flex;justify-content:space-between;align-items:end;gap:20px;margin:34px 0 15px}.rt-section-head h2{font-size:18px;letter-spacing:-.025em;margin:0}.rt-section-head p{margin:6px 0 0;color:#858999;font-size:12px}.rt-section-head>span{color:#8f92a2;font-size:10px;letter-spacing:.12em}
        .rt-main-grid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(300px,.8fr);gap:14px}.rt-panel{border:1px solid #262936;background:rgba(15,16,23,.9);border-radius:15px;padding:22px;min-width:0}.rt-panel-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:19px}.rt-panel-title strong{font-size:13px}.rt-panel-title span{font-size:10px;color:#8f92a2;letter-spacing:.12em}.rt-stage-list{display:grid;gap:9px}.rt-stage{display:grid;grid-template-columns:36px 1fr auto;align-items:center;gap:12px;padding:12px;border:1px solid #252733;background:#11131a;border-radius:10px}.rt-stage-num{font-size:10px;color:#a995f2;font-weight:800}.rt-stage strong{display:block;font-size:12px}.rt-stage small{display:block;margin-top:4px;color:#838696;font-size:11px}.rt-stage-status{font-size:9px;letter-spacing:.09em;color:#91d7b4;display:flex;align-items:center;gap:5px}.rt-stage-status.pending{color:#b3a0ff}.rt-detail-list{display:grid}.rt-detail{display:flex;justify-content:space-between;gap:18px;padding:13px 0;border-bottom:1px solid #242631;font-size:12px}.rt-detail:last-child{border-bottom:0}.rt-detail span{color:#9295a5}.rt-detail strong{text-align:right;overflow-wrap:anywhere}.rt-provider-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.rt-provider{padding:13px;border:1px solid #282a37;background:#11131a;border-radius:10px;min-width:0}.rt-provider strong{display:block;font-size:12px;overflow-wrap:anywhere}.rt-provider span{display:block;margin-top:7px;color:#9295a5;font-size:10px;overflow-wrap:anywhere}.rt-empty{font-size:12px;color:#858999;line-height:1.6}.rt-footer{display:flex;justify-content:space-between;gap:12px;border-top:1px solid #242631;margin-top:34px;padding-top:19px;color:#727687;font-size:10px;letter-spacing:.04em}
        @media(max-width:980px){.rt-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.rt-title-row{align-items:flex-start;flex-direction:column}.rt-main-grid{grid-template-columns:1fr}.rt-health{white-space:normal}}
        @media(max-width:560px){.rt-top{height:65px;padding:0 16px}.rt-top-actions .rt-link span{display:none}.rt-wrap{padding:32px 16px 48px}.rt-grid{gap:9px}.rt-card{padding:14px}.rt-value{font-size:23px}.rt-panel{padding:15px}.rt-provider-grid{grid-template-columns:1fr}.rt-footer{flex-direction:column}.rt-section-head{align-items:flex-start;flex-direction:column}}
      `}</style>

      <header className="rt-top">
        <Link className="rt-brand" href="/"><span className="rt-logo"><Cpu size={18}/></span><span>CORE ENGINE <span style={{color:"#a88cff"}}>AI</span></span></Link>
        <div className="rt-top-actions">
          <Link className="rt-link" href="/"><ArrowLeft size={14}/><span>Główny interfejs</span></Link>
          <button className="rt-refresh" onClick={() => void refresh()} disabled={loading}><RefreshCw size={14} className={loading ? "rt-spin" : ""}/>{loading ? "Sprawdzam…" : "Odśwież status"}</button>
        </div>
      </header>

      <div className="rt-wrap">
        <div className="rt-eyebrow"><span className="rt-pulse"/><span>CONTROL PLANE / LIVE TELEMETRY</span></div>
        <div className="rt-title-row">
          <div><h1>Runtime <span>Overview.</span></h1><p>Operacyjny podgląd Core Engine AI oparty na odpowiedzi rzeczywistego endpointu runtime. Statusy poniżej pochodzą z API — nie z przykładowych danych demonstracyjnych.</p></div>
          <div className="rt-health">{loading ? <RefreshCw size={15}/> : health ? <CheckCircle2 size={15}/> : <CircleAlert size={15}/>} {loading ? "ODCZYT STATUSU" : health ? "API RUNTIME ODPOWIADA" : "WYMAGA WERYFIKACJI"}</div>
        </div>

        {error && <div className="rt-error" role="alert">{error} <button onClick={() => void refresh()} style={{marginLeft:12,background:"transparent",border:0,color:"inherit",textDecoration:"underline",cursor:"pointer"}}>Ponów</button></div>}

        <div className="rt-grid">
          <article className="rt-card"><div className="rt-card-top"><span>Runtime state</span><span className="rt-icon"><Activity size={16}/></span></div><div className="rt-value">{loading && !data ? "…" : label(runtime?.status, "Brak danych")}</div><div className="rt-note">Odczyt z GET /api/agent</div></article>
          <article className="rt-card"><div className="rt-card-top"><span>Persistence</span><span className="rt-icon"><Database size={16}/></span></div><div className="rt-value">{label(runtime?.persistence, "Brak danych")}</div><div className="rt-note">Trwały zapis: {label(runtime?.durable, "Niepotwierdzony")}</div></article>
          <article className="rt-card"><div className="rt-card-top"><span>Capability adapters</span><span className="rt-icon"><Layers3 size={16}/></span></div><div className="rt-value">{loading && !data ? "…" : adapters.length}</div><div className="rt-note">Adaptery zwrócone przez runtime API</div></article>
          <article className="rt-card"><div className="rt-card-top"><span>Capability packs</span><span className="rt-icon"><Workflow size={16}/></span></div><div className="rt-value">{label(runtime?.capabilityPacks, loading ? "…" : "Brak danych")}</div><div className="rt-note">Zarejestrowane pakiety możliwości</div></article>
        </div>

        {runtime?.readinessReasons?.length ? <div className="rt-error" role="status"><strong>Runtime działa w trybie ograniczonym.</strong> {runtime.readinessReasons.join(" ")}</div> : null}

        <div className="rt-section-head"><div><h2>Runtime controls</h2><p>Aktualna konfiguracja bramek i zapisu.</p></div><span>{updatedAt ? "OSTATNI ODCZYT · " + updatedAt : "OCZEKIWANIE NA ODCZYT"}</span></div>
        <div className="rt-main-grid">
          <section className="rt-panel">
            <div className="rt-panel-title"><strong><ShieldCheck size={15} style={{verticalAlign:"-3px",marginRight:8,color:"#b9a2ff"}}/>Kontrola wykonania</strong><span>POLICY / SAFETY</span></div>
            <div className="rt-stage-list">
              {[
                ["01","Request & manifest","Punkt wejścia agenta i kontrakt runtime",data?.ok ? "API OK" : "OCZEKUJE"],
                ["02","Capability routing","Adaptery i pakiety możliwości",adapters.length ? adapters.length + " ADAPTERÓW" : "BRAK DANYCH"],
                ["03","Durable persistence","Tryb przechowywania wyników",runtime?.durable ? "TRWAŁY ZAPIS" : "WYMAGA SPRAWDZENIA"],
                ["04","Approval boundary","Wymagana zgoda dla operacji wysokiego ryzyka",runtime?.approvalRequiredForHighRiskActions ? "WŁĄCZONA" : "NIEPOTWIERDZONA"],
                ["05","External side effects","Bezpośrednie skutki zewnętrzne runtime",runtime?.liveExternalSideEffects ? "AKTYWNE" : "ZABLOKOWANE / BRAK"]
              ].map(([n,title,desc,status], index) => <div className="rt-stage" key={n}><span className="rt-stage-num">{n}</span><div><strong>{title}</strong><small>{desc}</small></div><span className={"rt-stage-status " + (index===2 && !runtime?.durable ? "pending" : "")}>{index===0 && data?.ok ? <CheckCircle2 size={12}/> : index===3 && runtime?.approvalRequiredForHighRiskActions ? <ShieldCheck size={12}/> : <Zap size={12}/>} {status}</span></div>)}
            </div>
          </section>
          <section className="rt-panel">
            <div className="rt-panel-title"><strong><Bot size={15} style={{verticalAlign:"-3px",marginRight:8,color:"#b9a2ff"}}/>Środowisko agenta</strong><span>CONFIG SNAPSHOT</span></div>
            <div className="rt-detail-list">
              <div className="rt-detail"><span>Nazwa agenta</span><strong>{label(data?.agent?.name, "Core Engine")}</strong></div>
              <div className="rt-detail"><span>Wersja manifestu</span><strong>{label(data?.agent?.version, "Niepodana")}</strong></div>
              <div className="rt-detail"><span>Stan API</span><strong>{data?.ok ? "OK" : loading ? "Odczyt…" : "Błąd"}</strong></div>
              <div className="rt-detail"><span>Ochrona operacji</span><strong>{runtime?.approvalRequiredForHighRiskActions ? "Human approval gate" : "Niepotwierdzona"}</strong></div>
              <div className="rt-detail"><span>Skutki zewnętrzne</span><strong>{runtime?.liveExternalSideEffects ? "Włączone" : "Nieaktywne"}</strong></div>
              <div className="rt-detail"><span>Ostatnia aktualizacja</span><strong>{updatedAt || "—"}</strong></div>
            </div>
            <div style={{marginTop:22,padding:14,border:"1px solid #2c2940",background:"#15121f",borderRadius:10}}>
              <div style={{fontSize:11,fontWeight:800,color:"#bca6ff",display:"flex",alignItems:"center",gap:7}}><Sparkles size={14}/> Uruchom zadanie</div>
              <p style={{fontSize:12,lineHeight:1.6,color:"#9698a8",margin:"8px 0 12px"}}>Przejdź do głównej konsoli, aby przekazać polecenie agentowi i obejrzeć rezultat wykonania.</p>
              <Link href="/#agent" className="rt-link" style={{width:"100%",justifyContent:"center"}}>Otwórz konsolę agenta <ArrowUpRight size={14}/></Link>
            </div>
          </section>
        </div>

        <div className="rt-section-head"><div><h2>Provider readiness</h2><p>Wartości odczytane z runtime, bez ujawniania sekretów.</p></div><span>PROVIDER LAYER</span></div>
        <section className="rt-panel">
          {providerEntries.length ? <div className="rt-provider-grid">{providerEntries.map(([key,value]) => <div className="rt-provider" key={key}><strong>{key}</strong><span>{label(value)}</span></div>)}</div> : <p className="rt-empty">Endpoint nie zwrócił mapy gotowości dostawców w formacie klucz-wartość. Szczegółowy stan adapterów pozostaje widoczny w liczbie i obiekcie odpowiedzi runtime.</p>}
        </section>

        <footer className="rt-footer"><span>CORE ENGINE AI · RUNTIME CONSOLE</span><span><Clock3 size={11} style={{verticalAlign:"-2px",marginRight:5}}/>Odczyt: {updatedAt || "nie wykonano"}</span><span>Telemetry source: /api/agent</span></footer>
      </div>
      <style jsx>{`@keyframes rt-rotate{to{transform:rotate(360deg)}}.rt-spin{animation:rt-rotate 1s linear infinite}`}</style>
    </main>
  );
}
