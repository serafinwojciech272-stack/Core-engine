"use client";

import { FormEvent, useRef, useState } from "react";
import { ArrowUp, Bot, CheckCircle2, FileText, Loader2, Paperclip, ShieldCheck, Sparkles, X, Play, Check } from "lucide-react";

type Attachment = { name: string; type: string; size: number; file: File };

type OSRun = { runId:string; state:string; approvalId:string|null; objective:string; skillIds:string[]; toolIds:string[]; agentIds:string[]; evidence:string[]; outcome:string|null; createdAt:string; updatedAt:string; digest:string };
type AgentMessage = { role: "user" | "agent"; text: string; plan?: string[]; intent?: string; gate?: string; confidence?: number; capability?: string; deliverables?: string[]; assumptions?: string[]; kpis?: string[]; risks?: string[]; nextAction?: string; missionId?: string; missionState?: string; capabilityActionId?: string; agentRunId?: string; osRun?: OSRun; };
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
  objective?: string;
  deliverables?: string[];
  assumptions?: string[];
  kpis?: string[];
  risks?: string[];
  nextAction?: string;
  agentRunId?: string;
  osRun?: OSRun;
};

const examples = [
  "Utwórz stronę WWW dla mojego biznesu",
  "Zbuduj aplikację do zarządzania ofertami",
  "Przeanalizuj ten PDF i znajdź najważniejsze ryzyka",
  "Popraw tę fotografię i przygotuj wersję do publikacji",
  "Przeanalizuj plik XLS i wskaż anomalie oraz trendy",
  "Zaprojektuj plan marketingowy na 90 dni"
];

function PlusIcon() { return <span style={{fontSize:"12px"}}>+</span>; }

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
  type MissionState = {
    id: string;
    state: string;
    objective: string;
    capabilityActionId?: string;
    osRun?: AgentMessage["osRun"];
  };
  const [mission, setMission] = useState<MissionState | null>(null);
  const [missionBusy, setMissionBusy] = useState(false);
  const [documentContext, setDocumentContext] = useState("");
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
      let parsedContext = "";
      if (attachments.length) {
        const form = new FormData();
        attachments.forEach((item) => form.append("file", item.file, item.name));
        const fileResponse = await fetch("/api/agent/file", { method: "POST", body: form });
        const fileData = await fileResponse.json();
        if (!fileResponse.ok) throw new Error(fileData.error || "Nie udało się przeanalizować pliku.");
        parsedContext = (fileData.files || []).map((item: {name:string;stats:unknown;metadata:unknown;extractedText:string}) =>
          "FILE: " + item.name + "\nSTATS: " + JSON.stringify(item.stats) + "\nMETADATA: " + JSON.stringify(item.metadata) + "\nEXTRACTED TEXT:\n" + item.extractedText
        ).join("\n\n");
        setDocumentContext(parsedContext);
      }
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ task: value, attachments: attachments.map(({name,type,size}) => ({name,type,size})), documentContext: parsedContext.slice(0, 50000) })
      });
      const data = (await response.json()) as AgentResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "Nie udało się uruchomić agenta.");
      setMessages((m) => [...m, {
        role: "agent",
        text: data.reply,
        plan: data.plan,
        intent: data.intent,
        gate: data.execution,
        confidence: data.confidence,
        capability: data.capability,
        deliverables: data.deliverables,
        assumptions: data.assumptions,
        kpis: data.kpis,
        risks: data.risks,
        nextAction: data.nextAction,
        agentRunId: data.agentRunId,
        osRun: data.osRun,
      }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd agenta.");
    } finally {
      setLoading(false);
    }
  }

  async function createMission(messageIndex: number, intent: string | undefined, text: string, osRun: AgentMessage["osRun"]) {
    if (missionBusy || mission) return;
    setMissionBusy(true); setError("");
    try {
      const response = await fetch("/api/engine", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({
        domain: intent === "DOCUMENT_ANALYSIS" ? "document" : intent === "IMAGE_TASK" ? "creative" : intent === "RESEARCH" ? "research" : "general",
        signals: [{ name: "agent_task", value: text.slice(0, 200), source: "core-agent" }, { name: "intent", value: intent || "GENERAL_AGENT", source: "core-agent" }]
      })});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Nie udało się utworzyć misji.");
      let capabilityActionId: string | undefined;
      try {
        const caps = await fetch("/api/capabilities?q=" + encodeURIComponent(intent || "agent")).then((x) => x.json());
        const actions = (caps.packs || []).flatMap((p: {actions?: Array<{id:string;name:string;requiresApproval?:boolean}>}) => p.actions || []);
        const preferred = actions.find((a: {id:string;name:string}) => {
          const s = (a.id + " " + a.name).toLowerCase();
          if (intent === "WEB_BUILD" || intent === "APP_BUILD") return /build|deploy|create|website|application/.test(s);
          if (intent === "DOCUMENT_ANALYSIS") return /document|file|analysis|parse|extract/.test(s);
          if (intent === "IMAGE_TASK") return /image|photo|creative/.test(s);
          if (intent === "RESEARCH") return /research|web|search|audit/.test(s);
          return /cognition|plan|analysis|workflow/.test(s);
        });
        capabilityActionId = preferred?.id;
      } catch {}
      const m: MissionState = { id: data.mission.id, state: data.mission.state, objective: data.mission.objective, capabilityActionId, osRun };
      setMission(m);
      setMessages((items) => items.map((item, i) => i === messageIndex ? { ...item, missionId: m.id, missionState: m.state, capabilityActionId } : item));
    } catch (e) { setError(e instanceof Error ? e.message : "Błąd tworzenia misji."); }
    finally { setMissionBusy(false); }
  }

  async function missionAction(action: "approve" | "execute") {
    if (!mission || missionBusy) return;
    setMissionBusy(true); setError("");
    try {
      let nextOS: AgentMessage["osRun"] = mission.osRun;
      if (action === "approve" && nextOS) {
        const approval = await fetch("/api/universal-agent/os", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve", run: nextOS, approvalId: mission.id })
        });
        const approvedOS = await approval.json();
        if (!approval.ok) throw new Error(approvedOS.error || "Universal Agent OS approval failed.");
        nextOS = approvedOS.run;
      }
      const response = await fetch("/api/mission", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({
        id: mission.id, action, idempotencyKey: crypto.randomUUID(), capabilityActionId: mission.capabilityActionId
      })});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Mission action failed.");
      if (action === "execute" && nextOS && nextOS.state === "AWAITING_APPROVAL") {
        const approval = await fetch("/api/universal-agent/os", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve", run: nextOS, approvalId: mission.id })
        });
        const approvedOS = await approval.json();
        if (!approval.ok) throw new Error(approvedOS.error || "Universal Agent OS approval failed.");
        const executing = await fetch("/api/universal-agent/os", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "transition", run: approvedOS.run, next: "EXECUTING" })
        });
        const executingOS = await executing.json();
        if (!executing.ok) throw new Error(executingOS.error || "Universal Agent OS execution transition failed.");
        nextOS = executingOS.run;
      }
      setMission((m: MissionState | null) => m ? { ...m, state: data.mission?.state || m.state, osRun: nextOS } : m);
    } catch (e) { setError(e instanceof Error ? e.message : "Błąd misji."); }
    finally { setMissionBusy(false); }
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list).slice(0, 6).map((file) => ({ name: file.name, type: file.type || "application/octet-stream", size: file.size, file }));
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
                    <div className="agent-gate"><ShieldCheck size={13}/> {message.gate === "HUMAN_APPROVAL_REQUIRED" ? "HUMAN APPROVAL REQUIRED" : "SIMULATION ONLY"} <em>{message.intent} · {message.capability || "Core Intelligence"} · {typeof message.confidence === "number" ? Math.round(message.confidence * 100) + "% confidence" : ""}</em></div>
                    {message.deliverables?.length ? <div className="agent-result-block"><span>DELIVERABLES</span>{message.deliverables.map((item) => <div key={item}>• {item}</div>)}</div> : null}
                    {message.kpis?.length ? <div className="agent-result-block"><span>SUCCESS METRICS</span>{message.kpis.map((item) => <div key={item}>• {item}</div>)}</div> : null}
                    {message.risks?.length ? <div className="agent-result-block"><span>RISKS / UNCERTAINTY</span>{message.risks.map((item) => <div key={item}>• {item}</div>)}</div> : null}
                    {message.assumptions?.length ? <div className="agent-result-block"><span>ASSUMPTIONS</span>{message.assumptions.map((item) => <div key={item}>• {item}</div>)}</div> : null}
                    {message.nextAction ? <div className="agent-next-action"><strong>NEXT ACTION</strong><span>{message.nextAction}</span></div> : null}
                    {!message.missionId && <button className="agent-mission-button" disabled={missionBusy || Boolean(mission)} onClick={() => createMission(index, message.intent, message.text, message.osRun)}>{missionBusy ? <Loader2 size={13} className="spin"/> : <PlusIcon/>} CREATE MISSION</button>}
                  </div>}
                </div>
              ))}
              {loading && <div className="agent-message agent"><div className="message-label">CORE ENGINE AI</div><div className="agent-thinking"><Loader2 size={15} className="spin"/> Analizuję zadanie, dobieram capability i buduję plan…</div></div>}
            </div>

            {mission && <div className="agent-mission-panel">
              <div><span>MISSION CONTROL</span><strong>{mission.objective}</strong><small>{mission.id} · {mission.state} · OS {mission.osRun?.state || "UNLINKED"}</small></div>
              {mission.state === "AWAITING_APPROVAL" && <button onClick={() => missionAction("approve")} disabled={missionBusy}><Check size={13}/> APPROVE</button>}
              {mission.state === "APPROVED" && <button onClick={() => missionAction("execute")} disabled={missionBusy}><Play size={13}/> EXECUTE</button>}
              {mission.state !== "AWAITING_APPROVAL" && mission.state !== "APPROVED" && <b className="mission-state">{mission.state}</b>}
            </div>}

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
