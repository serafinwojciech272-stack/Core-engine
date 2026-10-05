"use client";

import { FormEvent, useRef, useState } from "react";
import { ArrowUp, Bot, CheckCircle2, FileText, Image as ImageIcon, Loader2, Paperclip, Plus, ShieldCheck, Sparkles, X } from "lucide-react";

type Attachment = { name: string; type: string; size: number };
type AgentMessage = { role: "user" | "agent"; text: string; plan?: string[]; intent?: string; gate?: string; };
type AgentResponse = {
  ok: boolean;
  reply: string;
  intent: string;
  confidence: number;
  plan: string[];
  requiresApproval: boolean;
  execution: "SIMULATION_ONLY" | "HUMAN_APPROVAL_REQUIRED";
  needsAttachment?: boolean;
  capability?: string;
};

const examples = [
  "Utwórz stronę WWW dla mojego biznesu",
  "Zbuduj aplikację do zarządzania ofertami",
  "Przeanalizuj ten PDF i znajdź najważniejsze ryzyka",
  "Popraw tę fotografię i przygotuj wersję do publikacji",
  "Przeanalizuj plik XLS i wskaż anomalie oraz trendy",
  "Zaprojektuj plan marketingowy na 90 dni"
];

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

export default function CoreAgentConsole() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [task, setTask] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const value = task.trim();
    if (!value || loading) return;
    setLoading(true);
    setError("");
    setMessages((m) => [...m, { role: "user", text: value }]);
    setTask("");
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ task: value, attachments })
      });
      const data = (await response.json()) as AgentResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "Nie udało się uruchomić agenta.");
      setMessages((m) => [...m, {
        role: "agent",
        text: data.reply,
        plan: data.plan,
        intent: data.intent,
        gate: data.execution,
      }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd agenta.");
    } finally {
      setLoading(false);
    }
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list).slice(0, 6).map((f) => ({ name: f.name, type: f.type || "application/octet-stream", size: f.size }));
    setAttachments((current) => [...current, ...next].slice(0, 6));
  }

  return (
    <section id="agent" className="agent-section" aria-labelledby="agent-title">
      <div className="agent-shell">
        <div className="agent-heading">
          <div>
            <div className="sectionhead"><span>CORE ENGINE AI · PERSONAL AGENT</span></div>
            <h2 id="agent-title">Powiedz, co chcesz zrobić.<br/><em>Core Engine zajmie się resztą.</em></h2>
            <p>Jeden interfejs do zadań analitycznych, kreatywnych, technicznych i operacyjnych. Najpierw rozumienie i plan, potem kontrolowana realizacja. Każda czynność powodująca efekt zewnętrzny pozostaje za bramką akceptacji.</p>
          </div>
          <div className="agent-status"><i/> AGENT ONLINE <b>HUMAN GATE</b></div>
        </div>

        <div className="agent-grid">
          <div className="agent-chat">
            <div className="agent-chat-head">
              <div className="agent-avatar"><Bot size={18}/></div>
              <div><strong>CORE ENGINE AI</strong><small>Universal task agent · decision intelligence</small></div>
              <span><i/> READY</span>
            </div>

            <div className="agent-messages" aria-live="polite">
              {messages.length === 0 ? (
                <div className="agent-empty">
                  <Sparkles size={22}/>
                  <strong>Jakie jest Twoje zadanie?</strong>
                  <p>Możesz napisać je normalnym językiem. Nie musisz znać komend ani struktury Core Engine.</p>
                  <div className="agent-examples">
                    {examples.map((example) => <button key={example} onClick={() => setTask(example)}>{example}</button>)}
                  </div>
                </div>
              ) : messages.map((message, index) => (
                <div className={"agent-message " + message.role} key={index}>
                  <div className="message-label">{message.role === "user" ? "TY" : "CORE ENGINE AI"}</div>
                  <p>{message.text}</p>
                  {message.plan && <div className="agent-plan">
                    <span>PROPOSED EXECUTION PLAN</span>
                    {message.plan.map((step, i) => <div key={step}><b>{String(i + 1).padStart(2, "0")}</b>{step}</div>)}
                    <div className="agent-gate"><ShieldCheck size={13}/> {message.gate === "HUMAN_APPROVAL_REQUIRED" ? "HUMAN APPROVAL REQUIRED" : "SIMULATION ONLY"} <em>{message.intent}</em></div>
                  </div>}
                </div>
              ))}
              {loading && <div className="agent-message agent"><div className="message-label">CORE ENGINE AI</div><div className="agent-thinking"><Loader2 size={15} className="spin"/> Analizuję zadanie, dobieram capability i buduję plan…</div></div>}
            </div>

            {attachments.length > 0 && <div className="agent-attachments">
              {attachments.map((file, i) => <span key={file.name + i}><FileText size={12}/>{file.name}<small>{formatSize(file.size)}</small><button onClick={() => setAttachments((a) => a.filter((_, n) => n !== i))} aria-label={"Usuń " + file.name}><X size={11}/></button></span>)}
            </div>}

            <form className="agent-composer" onSubmit={submit}>
              <button type="button" className="composer-icon" onClick={() => fileRef.current?.click()} aria-label="Dodaj plik"><Paperclip size={17}/></button>
              <input ref={fileRef} type="file" multiple hidden accept=".pdf,.xls,.xlsx,.doc,.docx,.csv,.txt,.json,.png,.jpg,.jpeg,.webp,.zip" onChange={(e) => addFiles(e.target.files)}/>
              <textarea value={task} onChange={(e) => setTask(e.target.value)} placeholder="Napisz zadanie dla Core Engine AI… np. „Przeanalizuj ten PDF i przygotuj listę najważniejszych ryzyk”" rows={2} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }}}/>
              <button className="composer-send" disabled={!task.trim() || loading} aria-label="Wyślij zadanie"><ArrowUp size={18}/></button>
            </form>
            <div className="agent-composer-foot"><span><ShieldCheck size={11}/> CONTROLLED EXECUTION</span><span><Paperclip size={11}/> PDF · XLS · DOC · CSV · IMAGE</span><span>ENTER = SEND · SHIFT+ENTER = NEW LINE</span></div>
            {error && <div className="error agent-error">{error}</div>}
          </div>

          <aside className="agent-capabilities">
            <div className="cap-head"><span>CAPABILITY MATRIX</span><small>ROUTING / LIVE</small></div>
            {[
              ["01","BUILD","Websites · apps · automations","BUILD"],
              ["02","ANALYZE","PDF · XLS · DOC · data","ANALYSIS"],
              ["03","CREATE","Images · copy · documents","CREATIVE"],
              ["04","RESEARCH","Web · market · competitors","RESEARCH"],
              ["05","OPERATE","Plans · workflows · missions","OPERATIONS"],
              ["06","DECIDE","Scenarios · risk · priorities","INTELLIGENCE"]
            ].map(([n,name,desc,tag]) => <div className="cap-item" key={n}><b>{n}</b><div><strong>{name}</strong><p>{desc}</p></div><span>{tag}</span></div>)}
            <div className="cap-footer"><CheckCircle2 size={14}/><div><strong>One agent. One control plane.</strong><p>OBSERVE → UNDERSTAND → DECIDE → APPROVE → EXECUTE → MEASURE → LEARN</p></div></div>
          </aside>
        </div>
      </div>
    </section>
  );
}
