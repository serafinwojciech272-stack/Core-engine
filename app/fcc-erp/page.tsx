"use client";
import { useEffect,useState } from "react";
import { Activity,AlertTriangle,ArrowUpRight,Bot,BriefcaseBusiness,Building2,CheckCircle2,CircleDollarSign,FileText,Gauge,Landmark,LifeBuoy,Package,RefreshCw,ShieldCheck,ShoppingCart,Users,WalletCards,Workflow } from "lucide-react";
import Link from "next/link";
import "./fcc-erp.css";

const modules=[["BOK","Customer service",LifeBuoy,"/fcc-erp/queue"],["CRM","Customers & history",Users],["Kontrakty","Rules & services",BriefcaseBusiness],["Sprzedaż","Orders & revenue",ShoppingCart],["Operacje","Service execution",Activity],["Magazyn","Inventory & assets",Package],["Finanse","AR / AP / GL",CircleDollarSign],["Billing","Invoice automation",FileText,"/fcc-erp/queue"],["KSeF","Fiscal handoff",Landmark],["Workflow","State machines",Workflow],["AI Control Plane","Risk & decisions",Bot],["Audit","Immutable trail",ShieldCheck]] as const;
const pipeline=["SOURCE DATA","CONTRACT","SERVICE EVENT","BILLING","VALIDATION","ANOMALY","APPROVAL","INVOICE","RECEIVABLE","PAYMENT","KSeF"];

export default function FccErpPage(){
 const[d,setD]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState(false);
 async function load(){setLoading(true);setError(false);try{const response=await fetch("/api/fcc-erp/command-center",{cache:"no-store"});if(!response.ok)throw new Error("command-center");setD(await response.json())}catch{setError(true)}finally{setLoading(false)}}
 useEffect(()=>{void load()},[]);
 const source=d?.source==="live"?"LIVE DATA":"CONTROL MODE";
 return <main className="erp-shell">
  <header className="erp-topbar">
   <Link href="/fcc-erp" className="erp-brand" aria-label="FCC ERP Command Center">
    <div className="erp-mark"><Building2 size={19}/></div><div><b>FCC ERP</b><span>CORE ENGINE CONTROL PLANE</span></div>
   </Link>
   <div className="erp-top-actions"><span className={"live-pill "+(error?"is-error":"")}><i/> {error?"DATA ERROR":source}</span><button className="sync-button" onClick={load} disabled={loading} aria-label="Synchronize FCC ERP data"><RefreshCw size={14} className={loading?"spin":""}/> {loading?"Syncing":"Sync"}</button></div>
  </header>
  <section className="erp-hero">
   <div><div className="eyebrow">FCC ZABRZE / ERP CORE / v1.3</div><h1>Command Center</h1><p>Jedno centrum operacyjne dla BOK, kontraktów, usług, finansów, billingów i workflow. Transakcje finansowe pozostają deterministyczne.</p>
    <div className="hero-actions"><Link href="/fcc-erp/queue" className="primary-action">Open Operational Queue <ArrowUpRight size={14}/></Link><span className="data-caption">{error?"Nie udało się odczytać live telemetry.":loading?"Pobieranie telemetry…":"Live control telemetry active"}</span></div>
   </div>
   <div className={"hero-status "+(error?"status-error":"")}><div className="status-ring">{error?<AlertTriangle size={21}/>:<Activity size={21}/>}</div><div><b>System state</b><span>{error?"Degraded":loading?"Synchronizing…":"Operational"}</span><small>{source}</small></div></div>
  </section>
  <section className="metric-grid">{[["Open BOK",d?.open_cases||0,LifeBuoy],["Invoices",d?.open_invoices||0,FileText],["Anomalies",d?.open_anomalies||0,AlertTriangle],["Approvals",d?.pending_approvals||0,CheckCircle2],["KSeF",d?.ksef_in_flight||0,Landmark],["AR overdue",d?.ar_overdue||0,WalletCards],["AP overdue",d?.ap_overdue||0,CircleDollarSign],["AR outstanding",d?.ar_outstanding||0,Gauge]].map(([l,v,I]:any)=><article className="metric-card" key={l} aria-label={`${l}: ${v}`}><div className="metric-icon"><I size={16}/></div><span>{l}</span><strong>{typeof v==="number"?new Intl.NumberFormat("pl-PL",{maximumFractionDigits:0}).format(v):v}</strong><small>{source.toLowerCase()}</small></article>)}</section>
  <section className="work-area"><div className="section-title"><div><span>01 / OPERATING MODEL</span><h2>Modules</h2></div><span className="section-meta">12 control domains</span></div><div className="module-grid">{modules.map(([n,desc,I,href])=>{const card=<><div className="module-icon"><I size={18}/></div><div><b>{n}</b><span>{desc}</span></div><ArrowUpRight size={14}/></>;return href?<Link className="module" key={n} href={href} aria-label={`${n}: ${desc}`}>{card}</Link>:<div className="module module-muted" key={n} aria-label={`${n}: ${desc}`}>{card}</div>})}</div></section>
  <section className="control-section"><div className="section-title"><div><span>02 / CONTROL PLANE</span><h2>Human manages exceptions.</h2></div><span className="section-meta">Approval Gate enforced</span></div><div className="pipeline">{pipeline.map((x,i)=><div className={"pipeline-step "+(i===6?"attention":"")} key={x}><span>{String(i+1).padStart(2,"0")}</span><b>{x}</b></div>)}</div><div className="control-note"><ShieldCheck size={18}/><div><b>Financial core is deterministic.</b><span>AI obserwuje, wykrywa anomalie i rekomenduje działania. Nie omija Approval Gate.</span></div></div></section>
  <footer className="erp-footer"><span>FCC ERP CORE · CORE ENGINE AI</span><span>TEST / KSeF DISABLED</span></footer>
 </main>
}