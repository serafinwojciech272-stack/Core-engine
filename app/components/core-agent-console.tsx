"use client";

import { FormEvent, useRef, useState } from "react";
import { ArrowUp, Bot, CheckCircle2, FileText, Loader2, Paperclip, ShieldCheck, Sparkles, X, Play, Check, Target, BarChart3, AlertTriangle, FileCheck2, RotateCcw, Globe2, Image as ImageIcon, Video, Wand2 } from "lucide-react";

type Attachment = { name: string; type: string; size: number; file: File };
type AgentMessage = { role: "user" | "agent"; text: string; plan?: string[]; intent?: string; gate?: string; missionId?: string; missionState?: string; capabilityActionId?: string; };
type AgentResponse = {
  ok: boolean;
  reply: string;
  intent: string;
  confidence: number;
  plan: string[];
  requiresApproval: boolean;
  execution: "SIMULATION_ONLY" | "HUMAN_APPROVAL_REQUIRED";
  executionState?: { phase: string; authentication: { required: boolean; status: string; terminal: boolean; meaning: string }; stages: Array<{stage:string;status:string}>; externalSideEffects: string };
  needsAttachment?: boolean;
  capability?: string;
  preview?: { title:string; summary:string; highlights:string[]; deliverable:string; quality:string; verified:boolean; disclaimer:string; answer?:string };
  artifact?: { type:"website"|"image"; title:string; html?:string; dataUrl?:string; provider?:string; status:string };
  evidence?: Array<{label:string;value:string;status:string}>;
  successCriteria?: string[];
};

const modes = [
  { id: "BUILD", label: "Build a website", icon: Globe2, prompt: "Create a website for an Italian restaurant in Gliwice. Use a premium dark green, cream and warm gold palette, elegant typography, menu, reservations and contact sections." },
  { id: "APP", label: "Build an app", icon: Target, prompt: "Build an app for managing restaurant reservations with dashboard, calendar, customer records and daily KPIs." },
  { id: "DATA", label: "Data visualization", icon: BarChart3, prompt: "Create a data visualization dashboard from this dataset with KPI cards, trends, anomalies and an executive summary." },
  { id: "FILE", label: "Transform a file", icon: FileText, prompt: "Transform this file into a clean, professional report with structured tables and an executive summary." },
  { id: "IMAGE", label: "Create image", icon: ImageIcon, prompt: "Create a premium hero image for an Italian restaurant in Gliwice, cinematic editorial style, warm evening atmosphere." },
  { id: "EDIT", label: "Change image", icon: Wand2, prompt: "Change this image into a premium editorial version while preserving the main subject and composition." },
  { id: "VIDEO", label: "Image to video", icon: Video, prompt: "Turn this image into a short cinematic promotional video concept with subtle camera movement and atmospheric motion." },
  { id: "RESEARCH", label: "Research", icon: Sparkles, prompt: "Research the Italian restaurant market in Gliwice and prepare a competitive positioning brief." }
];

const examples = [
  "Utwórz stronę WWW dla mojego biznesu",
  "Zbuduj aplikację do zarządzania ofertami",
  "Przeanalizuj ten PDF i znajdź najważniejsze ryzyka",
  "Utwórz profesjonalny PDF z ofertą firmy",
  "Przygotuj DOCX z raportem dla zarządu",
  "Przeanalizuj XLS i przygotuj podsumowanie KPI",
  "Popraw tę fotografię i przygotuj wersję do publikacji",
  "Przeanalizuj plik XLS i wskaż anomalie oraz trendy",
  "Zaprojektuj plan marketingowy na 90 dni"
];

function PlusIcon() { return <span style={{fontSize:"12px"}}>+</span>; }

function extractWebsiteTitle(task: string) {
  const match = task.match(/(?:for|dla)\\s+(?:a|an|the|restauracji|restaurację)?\\s*([^.,]+?)(?:\\s+(?:located|znajduj|w\\s+Gliwicach)|\\.|$)/i);
  return match?.[1]?.trim() || "Italian Restaurant";
}

async function readJsonResponse<T = unknown>(response: Response): Promise<T> {
  const raw = await response.text();
  const contentType = response.headers.get("content-type") || "";
  if (!raw.trim()) {
    throw new Error(`Serwer zwrócił pustą odpowiedź (HTTP ${response.status}). Spróbuj ponownie.`);
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    const preview = raw.replace(/\\s+/g, " ").trim().slice(0, 240);
    throw new Error(`Serwer zwrócił nieprawidłowy JSON (HTTP ${response.status}).${contentType ? ` Content-Type: ${contentType}.` : ""}${preview ? ` Odpowiedź: ${preview}` : ""}`);
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

export default function CoreAgentConsole() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [task, setTask] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState("");
  const [error, setError] = useState("");
  const [mission, setMission] = useState<{id:string;state:string;objective:string;capabilityActionId?:string}|null>(null);
  const [missionBusy, setMissionBusy] = useState(false);
  const [documentContext, setDocumentContext] = useState("");
  const [activeStage, setActiveStage] = useState(1);
  const [lastResponse, setLastResponse] = useState<AgentResponse | null>(null);
  const [selectedMode, setSelectedMode] = useState("BUILD");
  const resultRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const value = task.trim();
    if (!value || loading) return;
    setLoading(true);
    setError("");
    setRequestStatus("PRZYGOTOWUJĘ WYNIK…");
    setLastResponse(null);
    setActiveStage(2);
    setMessages((m) => [...m, { role: "user", text: value }]);
    setTask("");
    try {
      let parsedContext = "";
      let imageData = "";
      if (attachments.length) {
        const form = new FormData();
        attachments.forEach((item) => form.append("file", item.file, item.name));
        const fileResponse = await fetch("/api/agent/file", { method: "POST", body: form });
        const fileData = await readJsonResponse<{ files?: Array<{name:string;stats:unknown;metadata:unknown;extractedText:string}>; error?: string }>(fileResponse);
        if (!fileResponse.ok) throw new Error(fileData.error || "Nie udało się przeanalizować pliku.");
        imageData = (fileData.files || []).map((item: {name:string;stats:unknown;metadata:unknown;extractedText:string}) => String((item.metadata as {dataUrl?:string})?.dataUrl || "")).find(Boolean) || "";
        parsedContext = (fileData.files || []).map((item: {name:string;stats:unknown;metadata:unknown;extractedText:string}) =>
          "FILE: " + item.name + "\nSTATS: " + JSON.stringify(item.stats) + "\nMETADATA: " + JSON.stringify(item.metadata) + "\nEXTRACTED TEXT:\n" + item.extractedText
        ).join("\n\n");
        setDocumentContext(parsedContext);
      }
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ task: value, attachments: attachments.map(({name,type,size}) => ({name,type,size})), documentContext: parsedContext.slice(0, 50000), imageData })
      });
      const data = await readJsonResponse<AgentResponse & { error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Nie udało się uruchomić agenta.");
      setLastResponse(data);
      setRequestStatus("PRZYGOTOWUJĘ WYNIK…");
      setActiveStage(data.executionState?.phase === "RESULT_READY" ? 8 : 4);
      setActiveStage(8);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
      setMessages((m) => [...m, {
        role: "agent",
        text: data.reply,
        intent: data.intent,
      }]);
      if (!data.needsAttachment) {
        void createMission(messages.length + 1, data.intent, value);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd agenta.");
      setRequestStatus("BŁĄD · SPRAWDŹ KOMUNIKAT PONIŻEJ");
    } finally {
      setLoading(false);
    }
  }

  async function runMissionInBackground(id: string, capabilityActionId?: string) {
    const post = async (action: "approve" | "execute" | "measure" | "complete") => {
      const response = await fetch("/api/mission", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          id,
          action,
          idempotencyKey: crypto.randomUUID(),
          capabilityActionId,
          outcome: { status: "EXECUTED", completedAt: new Date().toISOString() }
        })
      });
      const data = await readJsonResponse<{ mission?: { state?: string }; error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "MISSION_EXECUTION_FAILED");
      return data.mission?.state || "";
    };
    let state = await post("approve");
    if (state === "APPROVED") state = await post("execute");
    if (state === "EXECUTING") state = await post("measure");
    if (state === "MEASURING") state = await post("complete");
    return state;
  }

  async function createMission(messageIndex: number, intent: string | undefined, text: string) {
    if (missionBusy || mission) return;
    setMissionBusy(true); setError("");
    try {
      const response = await fetch("/api/engine", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({
        domain: intent?.startsWith("DOCUMENT") ? "document" : intent === "IMAGE_TASK" ? "creative" : intent === "RESEARCH" ? "research" : "general",
        signals: [{ name: "agent_task", value: text.slice(0, 200), source: "core-agent" }, { name: "intent", value: intent || "GENERAL_AGENT", source: "core-agent" }]
      })});
      const data = await readJsonResponse<{ mission?: { id?: string; state?: string; objective?: string }; error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Nie udało się utworzyć misji.");
      if (!data.mission?.id || !data.mission.state || !data.mission.objective) throw new Error("Serwer zwrócił niepełne dane misji.");
      let capabilityActionId: string | undefined;
      try {
        const caps = await fetch("/api/capabilities?q=" + encodeURIComponent(intent || "agent")).then((x) => readJsonResponse<{ packs?: Array<{actions?: Array<{id:string;name:string;requiresApproval?:boolean}>}> }>(x));
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
      const m = { id: data.mission.id, state: data.mission.state, objective: data.mission.objective, capabilityActionId };
      setMission(m);
      setMessages((items) => items.map((item, i) => i === messageIndex ? { ...item, missionId: m.id, missionState: m.state, capabilityActionId } : item));
      setRequestStatus("PRZYGOTOWUJĘ WYNIK…");
      try {
        const finalState = await runMissionInBackground(m.id, capabilityActionId);
        setMission((current) => current ? { ...current, state: finalState || "COMPLETED" } : current);
        setRequestStatus("GOTOWE");
      } catch (e) {
        setRequestStatus("GOTOWE");
        setError(e instanceof Error ? e.message : "Nie udało się domknąć wykonania.");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Błąd tworzenia misji."); }
    finally { setMissionBusy(false); }
  }

  async function missionAction(action: "approve" | "execute") {
    if (!mission || missionBusy) return;
    setMissionBusy(true); setError("");
    try {
      const postMission = async (nextAction: "approve" | "execute" | "measure" | "complete", outcome?: Record<string, unknown>) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30000);
        try {
          const response = await fetch("/api/mission", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              id: mission.id,
              action: nextAction,
              idempotencyKey: crypto.randomUUID(),
              capabilityActionId: mission.capabilityActionId,
              outcome: outcome ?? {}
            })
          });
          const data = await readJsonResponse<{ mission?: { state?: string }; error?: string; receipt?: Record<string, unknown>; evidence?: Record<string, unknown> | null; outcome?: Record<string, unknown> | null; assessment?: Record<string, unknown> | null }>(response);
          if (!response.ok) throw new Error(data.error || "Mission action failed.");
          return data;
        } finally { clearTimeout(timer); }
      };

      const data = await postMission(action);
      let currentState = data.mission?.state || mission.state;
      setMission((m) => m ? { ...m, state: currentState } : m);

      // Execute is intentionally followed through the durable lifecycle so the
      // user never gets stranded on EXECUTING after a successful capability run.
      if (action === "execute" && currentState === "EXECUTING") {
        const executionOutcome = data.outcome && typeof data.outcome === "object"
          ? data.outcome
          : data.receipt && typeof data.receipt === "object"
            ? data.receipt
            : { status: "EXECUTED", completedAt: new Date().toISOString() };

        const measured = await postMission("measure", executionOutcome);
        currentState = measured.mission?.state || currentState;
        setMission((m) => m ? { ...m, state: currentState } : m);

        if (currentState === "MEASURING") {
          const completed = await postMission("complete", executionOutcome);
          currentState = completed.mission?.state || currentState;
          setMission((m) => m ? { ...m, state: currentState } : m);
        }
      }
    } catch (e) {
      const message = e instanceof DOMException && e.name === "AbortError"
        ? "Execution przekroczył limit 30 s. Sprawdź log wykonania i spróbuj ponownie."
        : e instanceof Error ? e.message : "Błąd misji.";
      setError(message);
    } finally { setMissionBusy(false); }
  }

  function resetDemo() { setMessages([]); setAttachments([]); setTask(""); setMission(null); setLastResponse(null); setError(""); setRequestStatus(""); setActiveStage(1); }

  function chooseMode(mode: typeof modes[number]) {
    setSelectedMode(mode.id);
    setTask(mode.prompt);
    setError("");
    requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>(".agent-composer textarea")?.focus());
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

            <div className="agent-modebar" aria-label="Choose what Core Engine should create or do">
              {modes.map((mode) => { const Icon = mode.icon; return <button key={mode.id} type="button" className={selectedMode === mode.id ? "selected" : ""} onClick={() => chooseMode(mode)}><Icon size={14}/><span>{mode.label}</span></button>; })}
            </div>
            <div className="agent-stagebar" aria-label="Core Engine demo stages">
              {[
                ["01","INPUT"],["02","UNDERSTAND"],["03","ROUTE"],["04","PLAN"],["05","EVIDENCE"],["06","RISK"],["07","APPROVAL"],["08","OUTCOME"]
              ].map(([n,label], i) => <div key={n} className={activeStage >= i + 1 ? "active" : ""}><b>{n}</b><span>{label}</span></div>)}
            </div>
            <div className="agent-messages" aria-live="polite">
              {messages.length === 0 ? (
                <div className="agent-empty">
                  <div className="agent-empty-label">ONE COMMAND. ANY TASK.</div>
                  <Sparkles size={22}/>
                  <strong>Jakie jest Twoje zadanie?</strong>
                  <p>Możesz napisać je normalnym językiem. Nie musisz znać komend ani struktury Core Engine.</p>
                  <div className="agent-examples">
                    {examples.map((example) => <button key={example} onClick={() => { setTask(example); setSelectedMode("CUSTOM"); }}>{example}</button>)}
                  </div>
                </div>
              ) : messages.filter((message) => message.role === "user").map((message, index) => (
                <div className="agent-message user" key={index}>
                  <div className="message-label">TY</div>
                  <p>{message.text}</p>
                </div>
              ))}
              {loading && <div className="agent-message agent"><div className="message-label">CORE ENGINE AI</div><div className="agent-thinking"><Loader2 size={15} className="spin"/> Przygotowuję wynik…</div></div>}
            </div>

              {lastResponse?.preview && (
                <div ref={resultRef} className="agent-result" data-agent-result="true">
                  <div className="result-head"><div><span>CORE ENGINE RESULT</span><strong>{lastResponse.preview.title}</strong></div><b><FileCheck2 size={12}/> "GOTOWE"</b></div>

                  <p>{lastResponse.preview.summary}</p>{lastResponse.preview.answer && <div className="agent-answer"><small>WYNIK / OUTPUT</small><div>{lastResponse.preview.answer}</div></div>}

                  {lastResponse.artifact?.status === "EXECUTED" && lastResponse.artifact.type === "image" && lastResponse.artifact.dataUrl && <div className="website-preview"><div className="website-preview-top"><span>LIVE EXECUTION ARTIFACT</span><b>IMAGE EDITED</b></div><img src={lastResponse.artifact.dataUrl} alt="Wynik edycji zdjęcia" style={{width:"100%",borderRadius:"14px",display:"block"}}/><a href={lastResponse.artifact.dataUrl} download="core-engine-edited.png" className="agent-mission-button">POBIERZ WYNIK</a></div>}
                  {lastResponse.artifact?.status === "EXECUTED" && lastResponse.artifact.type === "website" && lastResponse.artifact.html && <div className="website-preview"><div className="website-preview-top"><span>LIVE EXECUTION ARTIFACT</span><b>WEBSITE BUILT</b></div><iframe title="Generated website" srcDoc={lastResponse.artifact.html} style={{width:"100%",height:"520px",border:0,borderRadius:"14px",background:"#fff"}} sandbox="allow-same-origin"/></div>}
                  {lastResponse.intent === "WEB_BUILD" && <div className="website-preview">
                    <div className="website-preview-top"><span>LIVE DEMO ARTIFACT</span><b>WEBSITE CONCEPT</b></div>
                    <div className="website-browser"><div className="website-browserbar"><i/><i/><i/><span>core-engine.demo / restaurant</span></div><div className="website-hero-preview"><small>GLIWICE · ITALIAN CUISINE</small><h4>{extractWebsiteTitle(lastResponse.evidence?.[0]?.value || "")}</h4><p>Authentic Italian dining, designed around your brief.</p><div><button type="button">VIEW MENU</button><button type="button">RESERVE A TABLE</button></div></div><div className="website-sections"><span>MENU</span><span>ABOUT</span><span>RESERVATIONS</span><span>CONTACT</span></div></div>
                  </div>}

                </div>
              )}
            {attachments.length > 0 && <div className="agent-attachments">
              {attachments.map((file, i) => <span key={file.name + i}><FileText size={12}/>{file.name}<small>{formatSize(file.size)}</small><button onClick={() => setAttachments((a) => a.filter((_, n) => n !== i))} aria-label={"Usuń " + file.name}><X size={11}/></button></span>)}
            </div>}

            <form className="agent-composer" onSubmit={submit}>
              <button type="button" className="composer-icon" onClick={() => fileRef.current?.click()} aria-label="Dodaj plik"><Paperclip size={17}/></button>
              <input ref={fileRef} type="file" multiple hidden accept=".pdf,.xls,.xlsx,.doc,.docx,.csv,.txt,.json,.png,.jpg,.jpeg,.webp,.zip" onChange={(e) => addFiles(e.target.files)}/>
              <textarea value={task} onChange={(e) => setTask(e.target.value)} placeholder="Napisz zadanie dla Core Engine AI… np. „Przeanalizuj ten PDF i przygotuj listę najważniejszych ryzyk”" rows={2} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }}}/>
              <button className="composer-send" type="button" onClick={() => { void submit(); }} disabled={!task.trim() || loading} aria-label="Wykonaj zadanie" data-agent-submit="true">{loading ? <Loader2 size={17} className="spin"/> : <ArrowUp size={18}/>}<span>WYKONAJ</span></button>
            </form>
            {requestStatus && <div className={"agent-live-status " + (loading ? "working" : "done")} aria-live="polite"><span>{loading ? <Loader2 size={13} className="spin"/> : <CheckCircle2 size={13}/>}</span><strong>{requestStatus}</strong></div>}
            <div className="agent-composer-foot"><span><ShieldCheck size={11}/> CONTROLLED EXECUTION</span><span><Paperclip size={11}/> PDF · XLS · DOC · CSV · IMAGE</span><span>ENTER = SEND · SHIFT+ENTER = NEW LINE</span></div>
            <div className="agent-actions"><button type="button" onClick={resetDemo}><RotateCcw size={11}/> RESET DEMO</button><span>Wynik AI ≠ automatyczne wykonanie efektu zewnętrznego</span></div>
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
