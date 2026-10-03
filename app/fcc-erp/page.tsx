"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowUpRight, Bot, BriefcaseBusiness, Building2,
  CheckCircle2, ChevronRight, CircleDollarSign, ClipboardList, FileText,
  Gauge, Landmark, LifeBuoy, Package, RefreshCw, ShieldCheck, ShoppingCart,
  Users, WalletCards, Workflow
} from "lucide-react";
import "./fcc-erp.css";

type Metrics = {
  tenant_name: string;
  open_cases: number;
  open_invoices: number;
  open_anomalies: number;
  pending_approvals: number;
  ksef_in_flight: number;
  ar_outstanding: number;
  ar_overdue: number;
  ap_outstanding: number;
  ap_overdue: number;
  source: "live" | "fallback";
  checked_at: string;
};

const modules = [
  ["BOK", "Customer service", LifeBuoy],
  ["CRM", "Customers & history", Users],
  ["Kontrakty", "Rules & services", BriefcaseBusiness],
  ["Sprzedaż", "Orders & revenue", ShoppingCart],
  ["Operacje", "Service execution", Activity],
  ["Magazyn", "Inventory & assets", Package],
  ["Finanse", "AR / AP / GL", CircleDollarSign],
  ["Billing", "Invoice automation", FileText],
  ["KSeF", "Fiscal handoff", Landmark],
  ["Workflow", "State machines", Workflow],
  ["AI Control Plane", "Risk & decisions", Bot],
  ["Audit", "Immutable trail", ShieldCheck]
] as const;

function money(value: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(value);
}

export default function FccErpPage() {
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/fcc-erp/command-center", { cache: "no-store" });
      const next = await response.json();
      setData(next);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const cards = useMemo(() => data ? [
    ["Open BOK", data.open_cases, "cases", LifeBuoy],
    ["Invoices", data.open_invoices, "open", FileText],
    ["Anomalies", data.open_anomalies, "review", AlertTriangle],
    ["Approvals", data.pending_approvals, "pending", CheckCircle2],
    ["KSeF", data.ksef_in_flight, "in flight", Landmark],
    ["AR overdue", money(data.ar_overdue), "receivables", WalletCards],
    ["AP overdue", money(data.ap_overdue), "payables", CircleDollarSign],
    ["AR outstanding", money(data.ar_outstanding), "total", Gauge]
  ] as const : []);

  return (
    <main className="erp-shell">
      <header className="erp-topbar">
        <div className="erp-brand">
          <div className="erp-mark"><Building2 size={19}/></div>
          <div><b>FCC ERP</b><span>CORE ENGINE CONTROL PLANE</span></div>
        </div>
        <div className="erp-top-actions">
          <span className="live-pill"><i/> {data?.source === "live" ? "LIVE DATA" : "CONTROL MODE"}</span>
          <button onClick={load} disabled={loading}><RefreshCw size={14} className={loading ? "spin" : ""}/> Sync</button>
        </div>
      </header>

      <section className="erp-hero">
        <div>
          <div className="eyebrow">FCC ZABRZE / ERP CORE / 01</div>
          <h1>Command Center</h1>
          <p>Jedno centrum operacyjne dla BOK, kontraktów, usług, finansów, billingów i workflow. CORE ENGINE obserwuje system, ale transakcje pozostają deterministyczne.</p>
        </div>
        <div className="hero-status">
          <div className="status-ring"><Activity size={21}/></div>
          <div><b>System state</b><span>{loading ? "Synchronizacja…" : "Operational"}</span></div>
          <small>{data?.checked_at ? new Date(data.checked_at).toLocaleTimeString("pl-PL") : "—"}</small>
        </div>
      </section>

      <section className="metric-grid">
        {cards.map(([label,value,sub,Icon]) => (
          <article className="metric-card" key={label}>
            <div className="metric-icon"><Icon size={16}/></div>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{sub}</small>
          </article>
        ))}
      </section>

      <section className="work-area">
        <div className="section-title">
          <div><span>01 / OPERATING MODEL</span><h2>Modules</h2></div>
          <p>{data?.tenant_name ?? "FCC Zabrze"} · ERP Core v1</p>
        </div>
        <div className="module-grid">
          {modules.map(([name,desc,Icon]) => (
            <button className="module" key={name}>
              <div className="module-icon"><Icon size={18}/></div>
              <div><b>{name}</b><span>{desc}</span></div>
              <ArrowUpRight size={14}/>
            </button>
          ))}
        </div>
      </section>

      <section className="control-section">
        <div className="section-title">
          <div><span>02 / CONTROL PLANE</span><h2>Human manages exceptions.</h2></div>
        </div>
        <div className="pipeline">
          {["SOURCE DATA","CONTRACT","SERVICE EVENT","BILLING","VALIDATION","ANOMALY","APPROVAL","KSeF","PAYMENT","LEARNING"].map((step,i) => (
            <div className={`pipeline-step ${i === 6 ? "attention" : i > 6 ? "future" : ""}`} key={step}>
              <span>{String(i+1).padStart(2,"0")}</span><b>{step}</b>{i < 9 && <ChevronRight size={13}/>}
            </div>
          ))}
        </div>
        <div className="control-note">
          <ShieldCheck size={18}/>
          <div><b>Financial core is deterministic.</b><span>AI analyses context, detects anomalies and proposes action. It does not invent accounting entries or bypass approval gates.</span></div>
        </div>
      </section>

      <footer className="erp-footer">
        <span>FCC ERP CORE · CORE ENGINE AI</span>
        <span>Source: {data?.source === "live" ? "Supabase / FCC tenant" : "safe fallback"} · <strong>TEST / KSeF DISABLED</strong></span>
      </footer>
    </main>
  );
}
