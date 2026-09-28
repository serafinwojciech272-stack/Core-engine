"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, BrainCircuit, Check, CircleDot, Globe2, Loader2, RefreshCw, Search, ShieldCheck, Sparkles, Zap } from "lucide-react";

type Job = {
  id: string; title: string; company: string | null; location: string | null; salary: string | null;
  match_score: number | null; source: string; url: string; decision: string | null; status: string | null;
};
type Decision = { recommendation: string; diagnosis: string; confidence: number; priority: string };
type Lang = "pl" | "en";

const copy = {
  pl: {
    brand:"CORE ENGINE / JOB AGENT", home:"Core Engine", eyebrow:"AI AGENT DO ANALIZY I WYSZUKIWANIA PRACY",
    title:"Znajdź właściwą pracę.", title2:"Niech silnik wykona analizę.",
    lead:"Core Engine łączy profil kandydata, ograniczenia, sygnały rynku i historię wyników w jeden proces decyzyjny. Wyszukuje, filtruje, ocenia i przygotowuje oferty do świadomej akceptacji.",
    input:"WEJŚCIE SILNIKA", policy:"Twoja polityka wyszukiwania", criteria:["Gliwice / Zabrze + 30 km","Niemiecki B2+","Angielski B2+","Doświadczenie menedżerskie / handlowe","Bez prawa jazdy — nie traktuj go jako warunku","Business Development / Operations / CX / Sales / Account"],
    mode:"TRYB APLIKOWANIA", review:"REVIEW BEFORE SUBMIT", run:"Uruchom Core Engine", running:"Core Engine analizuje...", sync:"Odśwież oferty", syncing:"Synchronizacja...",
    decision:"WARSTWA DECYZYJNA", waiting:"Oczekiwanie na dane", waitText:"Uruchom silnik, aby przekształcić profil i ograniczenia w jawną politykę wyszukiwania. Każda aplikacja pozostaje za bramką akceptacji.",
    generated:"POLITYKA WYGENEROWANA", confidence:"PEWNOŚĆ", priority:"PRIORYTET",
    sources:"ŹRÓDŁA DISCOVERY", coverage:"Pokrycie rynku na żywo", sourceText:"Google/Serper jest warstwą discovery; poniższe serwisy są wyszukiwane i klasyfikowane z wyników na żywo.",
    hourly:"AUTOMATYCZNE ODŚWIEŻANIE · CO 60 MIN", pipeline:"PIPELINE OKAZJI", relevant:"Oferty dopasowane do profilu",
    loading:"ładowanie...", matches:"dopasowań", company:"Firma nieodczytana", location:"Lokalizacja nieodczytana", salary:"Wynagrodzenie nieujawnione",
    reviewBtn:"OTWÓRZ I ZWERYFIKUJ", guard:"Discovery jest świadome źródeł. Aplikacje działają w trybie REVIEW BEFORE SUBMIT — silnik nie wysyła aplikacji automatycznie.",
    last:"Ostatnia synchronizacja", discovered:"znaleziono", stored:"zapisano", empty:"Brak zsynchronizowanych ofert. Uruchom synchronizację, aby pobrać aktualny rynek.",
    footer:"Obserwuj → Zrozum → Priorytetyzuj → Decyduj → Zatwierdź → Wykonaj → Zmierz → Ucz się",
    lang:"JĘZYK"
  },
  en: {
    brand:"CORE ENGINE / JOB AGENT", home:"Core Engine", eyebrow:"AI JOB INTELLIGENCE & DISCOVERY AGENT",
    title:"Find the right work.", title2:"Let the engine reason.",
    lead:"Core Engine combines candidate profile, constraints, live market signals and outcome history into one decision process. It discovers, filters, scores and prepares opportunities for deliberate approval.",
    input:"ENGINE INPUT", policy:"Your search policy", criteria:["Gliwice / Zabrze + 30 km","German B2+","English B2+","Management / commercial experience","No driving licence — never treat it as a requirement","Business Development / Operations / CX / Sales / Account"],
    mode:"APPLICATION MODE", review:"REVIEW BEFORE SUBMIT", run:"Run Core Engine", running:"Core Engine is reasoning...", sync:"Refresh opportunities", syncing:"Synchronizing...",
    decision:"DECISION LAYER", waiting:"Waiting for evidence", waitText:"Run the engine to turn your profile and constraints into an explicit search policy. Every application remains behind an approval gate.",
    generated:"POLICY GENERATED", confidence:"CONFIDENCE", priority:"PRIORITY",
    sources:"DISCOVERY SOURCES", coverage:"Live market coverage", sourceText:"Google/Serper is the discovery layer; the providers below are searched and classified from live results.",
    hourly:"AUTOMATIC REFRESH · EVERY 60 MIN", pipeline:"LIVE OPPORTUNITY PIPELINE", relevant:"Profile-matched openings",
    loading:"loading...", matches:"matches", company:"Company not extracted", location:"Location not extracted", salary:"Salary not disclosed",
    reviewBtn:"OPEN & REVIEW", guard:"Discovery is provider-aware. Applications remain REVIEW BEFORE SUBMIT — the engine never submits automatically.",
    last:"Last sync", discovered:"discovered", stored:"stored", empty:"No synchronized opportunities yet. Run a sync to pull the current market.",
    footer:"Observe → Understand → Prioritize → Decide → Approve → Execute → Measure → Learn",
    lang:"LANGUAGE"
  }
} as const;

const providers=["Pracuj.pl","Indeed","OLX","LinkedIn Jobs","No Fluff Jobs","Just Join IT","RocketJobs","Pracapolis","Adzuna","Jooble"];

export default function JobsPage() {
  const pathname=usePathname(); const standalone=pathname==="/job-agent";
  const [lang,setLang]=useState<Lang>("pl"); const t=copy[lang];
  const [running,setRunning]=useState(false),[loadingJobs,setLoadingJobs]=useState(true),[decision,setDecision]=useState<Decision|null>(null),[status,setStatus]=useState("");
  const [jobs,setJobs]=useState<Job[]>([]),[selectedJob,setSelectedJob]=useState<Job|null>(null),[application,setApplication]=useState<any>(null),[latestSync,setLatestSync]=useState<{finished_at?:string;discovered?:number;inserted?:number;status?:string}|null>(null);
  const criteria=useMemo(()=>t.criteria,[t]);

  useEffect(()=>{const saved=window.localStorage.getItem("job-agent-lang") as Lang|null;if(saved==="pl"||saved==="en")setLang(saved)},[]);
  useEffect(()=>{window.localStorage.setItem("job-agent-lang",lang)},[lang]);
  async function loadJobs(){setLoadingJobs(true);try{const r=await fetch("/api/jobs",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Job feed unavailable");setJobs(d.jobs||[]);setLatestSync(d.latestSync||null);return d.latestSync||null}catch(e){setStatus(e instanceof Error?e.message:"Job feed unavailable");return null}finally{setLoadingJobs(false)}}
  async function runCoreEngine(){setRunning(true);setStatus("");try{const signals=[
    {name:"target_roles",value:"Business Development Manager; Operations Manager; Customer Experience Manager; Customer Service Manager; Sales Manager; Account Manager; Key Account Manager; Business Operations Manager; Process Manager; Commercial Manager; Team Leader/Supervisor; Export Manager; German Speaking Manager",source:"candidate_profile"},
    {name:"location_radius",value:"Gliwice/Zabrze + 30 km",source:"candidate_preference"},{name:"german_level",value:"B2+",source:"candidate_profile"},{name:"english_level",value:"B2+",source:"candidate_profile"},{name:"management_experience",value:"yes",source:"candidate_profile"},{name:"driving_license",value:"none",source:"candidate_constraint"},{name:"application_mode",value:"REVIEW_BEFORE_SUBMIT",source:"user_policy"}];
    const r=await fetch("/api/engine",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({domain:"jobs",signals})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Core Engine request failed");setDecision(d.decision);setStatus(lang==="pl"?"Polityka wyszukiwania wygenerowana przez Core Engine.":"Core Engine generated the search policy.")}catch(e){setStatus(e instanceof Error?e.message:"Core Engine request failed")}finally{setRunning(false)}}
  async function syncJobs(){setRunning(true);setStatus(t.syncing);try{const r=await fetch("/api/jobs/sync",{method:"POST"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Sync failed");setStatus(lang==="pl"?`Synchronizacja zakończona: ${d.sync.discovered} znaleziono, ${d.sync.inserted} zapisano.`:`Sync complete: ${d.sync.discovered} discovered, ${d.sync.inserted} stored.`);await loadJobs()}catch(e){setStatus(e instanceof Error?e.message:"Sync failed")}finally{setRunning(false)}}
  useEffect(()=>{(async()=>{const sync=await loadJobs();const finished=sync?.finished_at?Date.parse(sync.finished_at):0;const stale=!finished||Date.now()-finished>45*60*1000;if(stale){await syncJobs()}})()},[]);
  async function prepareApplication(job:Job){
    setSelectedJob(job); setApplication(null);
    setStatus(lang==="pl"?"Core Engine analizuje ofertę, CV i przygotowuje pakiet aplikacyjny...":"Core Engine is analyzing the job, CV and preparing the application package...");
    try{
      const r=await fetch("/api/jobs/application/prepare",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:job.url,title:job.title,company:job.company,location:job.location,description:(job as Job & { description?: string }).description,matchScore:job.match_score,decision:job.decision})});
      const d=await r.json(); if(!r.ok) throw new Error(d.error||"Application preparation failed");
      setApplication(d.application);
      setStatus(lang==="pl"?"Pakiet aplikacyjny gotowy do kontroli.":"Application package ready for review.");
    }catch(e){setStatus(e instanceof Error?e.message:"Application preparation failed")}
  }
  function openProvider(){if(!selectedJob)return;window.open(selectedJob.url,"_blank","noopener,noreferrer");setStatus(lang==="pl"?"Ogłoszenie otwarte. Ostateczne wysłanie pozostaje pod Twoją kontrolą.":"Job opened. Final submission remains under your control.");}
  return <main className={`jobs-page ${standalone?"job-agent-standalone":""}`}>
    <nav><div className="brand"><span className="mark"><BrainCircuit size={19}/></span><span>{t.brand}</span></div><div className="nav-right"><div className="language-switch" aria-label={t.lang}><Globe2 size={15}/><button className={lang==="pl"?"active":""} onClick={()=>setLang("pl")}>PL</button><span>/</span><button className={lang==="en"?"active":""} onClick={()=>setLang("en")}>EN</button></div><Link className="navbtn" href="/">{t.home} <ArrowRight size={15}/></Link></div></nav>
    <section className="jobs-hero"><div className="eyebrow"><span className="pulse"/>{t.eyebrow}</div>
      <h1>{t.title}<br/><em>{t.title2}</em></h1><p className="lead">{t.lead}</p>
      <div className="agent-architecture"><span>DISCOVER</span><ArrowRight/><span>FILTER</span><ArrowRight/><span>UNDERSTAND</span><ArrowRight/><span>DECIDE</span><ArrowRight/><span>REVIEW</span><ArrowRight/><span>LEARN</span></div>
      <div className="jobs-grid"><section className="profile-card"><div className="card-label">{t.input}</div><h2>{t.policy}</h2><div className="criteria">{criteria.map(x=><div key={x}><Check size={14}/><span>{x}</span></div>)}</div>
        <div className="mode-row"><div><div className="card-label">{t.mode}</div><b>{t.review}</b></div><span className="approval-pill"><ShieldCheck size={14}/> HUMAN GATE</span></div>
        <div className="jobs-actions"><button className="primary jobs-run" onClick={runCoreEngine} disabled={running}>{running?<Loader2 size={16} className="spin"/>:<Sparkles size={16}/>} {running?t.running:t.run}</button><button className="secondary jobs-run" onClick={syncJobs} disabled={running}>{running?<Loader2 size={16} className="spin"/>:<RefreshCw size={16}/>} {running?t.syncing:t.sync}</button></div>
        {status&&<div className="engine-status"><CircleDot size={13}/>{status}</div>}</section>
        <section className="decision-card"><div className="card-label">{t.decision}</div>{decision?<><div className="decision-state">{t.generated}</div><h2>{decision.recommendation}</h2><p>{decision.diagnosis}</p><div className="decision-stats"><div><small>{t.confidence}</small><strong>{Math.round(decision.confidence*100)}%</strong></div><div><small>{t.priority}</small><strong>{decision.priority}</strong></div></div></>:<><div className="decision-orb"><BrainCircuit size={34}/></div><h2>{t.waiting}</h2><p>{t.waitText}</p></>}</section></div>
    </section>
    <section className="provider-strip"><div><div className="card-label">{t.sources}</div><h2>{t.coverage}</h2><p>{t.sourceText}</p></div><div className="provider-list">{providers.map(source=><span key={source}>{source}</span>)}</div><div className="refresh-badge"><RefreshCw size={14}/>{t.hourly}</div></section>
    <section className="jobs-results"><div className="results-head"><div><div className="card-label">{t.pipeline}</div><h2>{t.relevant}</h2></div><span><Search size={14}/> {loadingJobs?t.loading:`${jobs.length} ${t.matches}`}</span></div>
      <div className="job-list">{jobs.map(job=><article className="job-card" key={job.id}><div className="job-main"><div className="match">{Math.round(job.match_score??0)}%</div><div><h3>{job.title}</h3><p>{job.company||t.company} · {job.location||t.location}</p><small>{job.source} · {job.decision||"REVIEW"}</small></div></div><div className="job-meta"><b>{job.salary||t.salary}</b><span>{job.status||"NEW"}</span></div><button className="apply" onClick={()=>prepareApplication(job)}>{lang==="pl"?"PRZYGOTUJ APLIKACJĘ":"PREPARE APPLICATION"} <ArrowRight size={14}/></button></article>)}{!loadingJobs&&jobs.length===0&&<div className="empty-state">{t.empty}</div>}</div>
      <div className="guard"><ShieldCheck size={16}/><span>{t.guard}</span></div>{latestSync&&<div className="guard"><CircleDot size={16}/><span>{t.last}: {latestSync.status||"UNKNOWN"} · {latestSync.discovered??0} {t.discovered} · {latestSync.inserted??0} {t.stored}</span></div>}
    </section>
    <div className="cv-entry"><Link className="secondary jobs-run" href="/cv">OTWÓRZ MOJE CV</Link><span>CV jest częścią profilu Core Engine i może być używane przy przygotowaniu aplikacji.</span></div>{selectedJob&&<div className="application-gate"><div className="application-panel"><div className="card-label">CORE ENGINE · APPLICATION GATE</div><h2>{selectedJob.title}</h2><p>{selectedJob.company||"Firma"} · {selectedJob.location||"Lokalizacja nieodczytana"}</p><div className="criteria"><div><Check size={14}/> CV kandydata załadowane do profilu</div><div><Check size={14}/> Dopasowanie oferty sprawdzone: {application?.match?.score ?? "—"}%</div><div><ShieldCheck size={14}/> Human approval wymagany przed wysłaniem</div></div>
{application&&<div className="application-preview"><div className="card-label">CV DOPASOWANE DO OFERTY</div><h3>{application.cv.tailoredHeadline}</h3><p>{application.cv.tailoredSummary}</p><div className="card-label">LIST MOTYWACYJNY</div><pre>{application.coverLetter}</pre>{application.match.risks?.length>0&&<div className="application-risks"><b>DO WERYFIKACJI</b>{application.match.risks.map((x:string)=><div key={x}>• {x}</div>)}</div>}</div>}<div className="jobs-actions"><Link className="secondary jobs-run" href="/cv">SPRAWDŹ CV</Link><button className="primary jobs-run" onClick={openProvider}>ZATWIERDZAM · OTWÓRZ OGŁOSZENIE</button><button className="secondary jobs-run" onClick={()=>setSelectedJob(null)}>ANULUJ</button></div></div></div>}<footer><span>CORE ENGINE · JOB AGENT</span><span>{t.footer}</span></footer>
  </main>
}