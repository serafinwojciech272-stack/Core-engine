"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, BrainCircuit, CheckCircle2, Circle, Database, Gauge, GitBranch, LockKeyhole, Play, Radar, ShieldCheck, Sparkles, Target, Zap } from "lucide-react";

type Json = Record<string, any>;
const domains = {
  Growth: [{ name: "Współczynnik konwersji", value: "2.8%", source: "analityka" }, { name: "Ruch", value: "+18%", source: "analityka" }, { name: "Porzucenie zakupu", value: "41%", source: "lejek" }],
  Sales: [{ name: "Kwalifikowane leady", value: "-14%", source: "CRM" }, { name: "Czas odpowiedzi", value: "11 h", source: "CRM" }, { name: "Współczynnik wygranych", value: "18%", source: "sprzedaż" }],
  Operations: [{ name: "Zaległości zamówień", value: "+27%", source: "operacje" }, { name: "Czas cyklu", value: "3,4 dnia", source: "ERP" }, { name: "Wykorzystanie przepustowości", value: "82%", source: "zasoby zespołu" }],
} as const;
const uiText = {
  pl:{core:"RDZEŃ SILNIK",control:"CENTRUM STEROWANIA AI",live:"AKTYWNA WARSTWA INTELIGENCJI",products:"PRODUKTY",roadmap:"PLAN ROZWOJU",investor:"DOŚWIADCZENIE INWESTORSKIE 03",agentEnv:"ŚRODOWISKO AGENTA",hero1:"Inteligencja",hero2:"w działaniu.",heroDesc:"Jeden centralny system sterowania zamienia rozproszone sygnały biznesowe w dowody, decyzje, zarządzane misje i mierzalne uczenie. Ten sam kontrakt agenta zasila każdą powierzchnię produktu.",runCore:"URUCHOM RDZEŃ",systemMap:"POKAŻ MAPĘ SYSTEMU",proof1:"{t("proof1")}",proof2:"{t("proof2")}",proof3:"{t("proof3")}",lab:"00 / POKAŻ AGENTA",labTitle1:"Daj nam problem.",labTitle2:"Zobacz, jak myśli rdzeń.",labDesc:"{t("labDesc")}",publicDemo:"{t("publicDemo")}",simulation:"{t("simulation")}",tryQuestion:"{t("tryQuestion")}",placeholder:"Przykład: Mamy 20 000 wizyt miesięcznie, ale bardzo mało osób kończy zakup. Co powinniśmy zbadać najpierw?",analyze:"{t("analyze")}",analyzing:"{t("analyzing")}",analysis:"{t("analysis")}",confidence:"{t("confidence")}",recommendation:"{t("recommendation")}",priority:"{t("priority")}",nextActions:"{t("nextActions")}",command:"{t("command")}",commandTitle:"Daj rdzeniowi sytuację biznesową.",activate:"AKTYWUJ RDZEŃ"},
  en:{core:"CORE ENGINE",control:"AI COMMAND CENTER",live:"ACTIVE INTELLIGENCE LAYER",products:"PRODUCTS",roadmap:"ROADMAP",investor:"INVESTOR EXPERIENCE 03",agentEnv:"AGENT ENVIRONMENT",hero1:"Intelligence",hero2:"in action.",heroDesc:"One central control system turns distributed business signals into evidence, decisions, governed missions and measurable learning. The same agent contract powers every product surface.",runCore:"RUN THE CORE",systemMap:"SHOW SYSTEM MAP",proof1:"evidence first",proof2:"approval boundary",proof3:"auditable state",lab:"00 / SHOW THE AGENT",labTitle1:"Give us a problem.",labTitle2:"See how the core thinks.",labDesc:"Describe a real business problem in your own words. The public demo turns it into context, evidence, diagnosis and a governed solution proposal. No private systems are used and no external actions are executed.",publicDemo:"PUBLIC AGENT DEMO",simulation:"SIMULATION",tryQuestion:"TRY A BUSINESS QUESTION",placeholder:"Example: We have 20,000 visits per month, but very few people complete checkout. What should we investigate first?",analyze:"ANALYZE MY PROBLEM",analyzing:"ANALYZING...",analysis:"AGENT ANALYSIS",confidence:"CONFIDENCE",recommendation:"01 / RECOMMENDATION",priority:"02 / PRIORITY",nextActions:"03 / NEXT ACTIONS",command:"01 / SIGNAL INPUT · SIMULATED DATA",commandTitle:"Give the core a business situation.",activate:"ACTIVATE CORE"},
  de:{core:"CORE ENGINE",control:"KI-LEITZENTRUM",live:"AKTIVE INTELLIGENZSCHICHT",products:"PRODUKTE",roadmap:"ROADMAP",investor:"INVESTOR-ERLEBNIS 03",agentEnv:"AGENTEN-UMGEBUNG",hero1:"Intelligenz",hero2:"in Aktion.",heroDesc:"Ein zentrales Steuerungssystem verwandelt verteilte Geschäftssignale in Belege, Entscheidungen, gesteuerte Missionen und messbares Lernen. Derselbe Agentenvertrag versorgt jede Produktschnittstelle.",runCore:"KERN STARTEN",systemMap:"SYSTEMKARTE ANZEIGEN",proof1:"Belege zuerst",proof2:"Freigabegrenze",proof3:"prüfbarer Zustand",lab:"00 / AGENT ZEIGEN",labTitle1:"Geben Sie uns ein Problem.",labTitle2:"Sehen Sie, wie der Kern denkt.",labDesc:"Beschreiben Sie ein reales Geschäftsproblem in eigenen Worten. Die öffentliche Demo wandelt es in Kontext, Belege, Diagnose und einen gesteuerten Lösungsvorschlag um. Es werden keine privaten Systeme genutzt und keine externen Aktionen ausgeführt.",publicDemo:"ÖFFENTLICHE AGENTEN-DEMO",simulation:"SIMULATION",tryQuestion:"GESCHÄFTSFRAGE AUSPROBIEREN",placeholder:"Beispiel: Wir haben 20.000 Besuche pro Monat, aber nur wenige schließen den Kauf ab. Was sollten wir zuerst untersuchen?",analyze:"MEIN PROBLEM ANALYSIEREN",analyzing:"ANALYSE...",analysis:"AGENTENANALYSE",confidence:"KONFIDENZ",recommendation:"01 / EMPFEHLUNG",priority:"02 / PRIORITÄT",nextActions:"03 / NÄCHSTE SCHRITTE",command:"01 / SIGNAL-EINGANG · SIMULIERTE DATEN",commandTitle:"Geben Sie dem Kern eine Geschäftssituation.",activate:"KERN AKTIVIEREN"},
  zh:{core:"核心引擎",control:"AI 指挥中心",live:"智能层已激活",products:"产品",roadmap:"发展路线",investor:"投资者体验 03",agentEnv:"智能体环境",hero1:"智能",hero2:"正在行动。",heroDesc:"一个中央控制系统将分散的业务信号转化为证据、决策、受治理的任务和可衡量的学习。同一智能体契约驱动所有产品界面。",runCore:"启动核心引擎",systemMap:"查看系统地图",proof1:"证据优先",proof2:"审批边界",proof3:"可审计状态",lab:"00 / 展示智能体",labTitle1:"给我们一个问题。",labTitle2:"看看核心如何思考。",labDesc:"用自己的语言描述真实业务问题。公开演示会将其转化为上下文、证据、诊断和受治理的解决方案建议。不使用私人系统，也不会执行任何外部操作。",publicDemo:"公开智能体演示",simulation:"模拟",tryQuestion:"尝试一个业务问题",placeholder:"例如：我们每月有20,000次访问，但完成结账的人很少。我们应该先调查什么？",analyze:"分析我的问题",analyzing:"分析中...",analysis:"智能体分析",confidence:"置信度",recommendation:"01 / 建议",priority:"02 / 优先级",nextActions:"03 / 下一步行动",command:"01 / 信号输入 · 模拟数据",commandTitle:"给核心引擎一个业务场景。",activate:"启动核心引擎"}
} as const;
type UiLang = keyof typeof uiText;
const copy = {
  pl:{context:"KONTEKST",evidence:"DOWODY",diagnosis:"DIAGNOZA",decision:"DECYZJA",governance:"ZARZĄDZANIE",explain:"{tx("explain")}",limits:"{tx("limits")}",policy:"{tx("policy")}",reversible:"{tx("reversible")}",executionGate:"{tx("executionGate")}",missing:"{tx("missing")}",nextEvidence:"{tx("nextEvidence")}",result:"{tx("result")}",contract:"{tx("contract")}",decisionMatrix:"{tx("decisionMatrix")}",evidenceQuality:"{tx("evidenceQuality")}",provenance:"{tx("provenance")}",riskGate:"{tx("riskGate")}",policyScore:"{tx("policyScore")}",audit:"{tx("audit")}",decisionCenter:"{tx("decisionCenter")}",reasoning:"{tx("reasoning")}",evidenceGraph:"{tx("evidenceGraph")}",missionControl:"{tx("missionControl")}",currentState:"Aktualny stan:",controlled:"kontrolowane przejście · weryfikacja wyniku demo aktywna",learningReady:"{tx("learningReady")}",commercial:"03.5 / KOMERCYJNY {tx("contract")}",commercialTitle:"{tx("commercialTitle")}",commercialTitle2:"{tx("commercialTitle2")}",multiTenant:"{tx("multiTenant")}",multiTenantDesc:"Tożsamość, izolacja tenantów/workspace'ów, pomiar użycia i limity planów są jawnie zdefiniowanymi kontraktami produktu. Trwała persystencja produkcyjna pozostaje oparta o Supabase.",planModel:"{tx("planModel")}",riskNote:"{tx("riskNote")}",intelligence:"{tx("intelligence")}",oneCore:"{tx("oneCore")}",seven:"{tx("seven")}",productsSurface:"{tx("productsSurface")}",same:"{tx("same")}",three:"{tx("three")}",decisionIntel:"{tx("decisionIntel")}",businessOS:"{tx("businessOS")}",opportunity:"{tx("opportunity")}",evidenceLayer:"{tx("evidenceLayer")}",productCore:"{tx("productCore")}",productLab:"{tx("productLab")}",roadmapTitle:"{tx("roadmapTitle")}",roadmapTitle2:"{tx("roadmapTitle2")}",backTop:"{tx("backTop")}",oneCoreMany:"{tx("oneCoreMany")}",contextEngine:"SILNIK KONTEKSTU",contextDesc:"Normalizuje sygnały, domenę i kontekst operacyjny",evidenceDesc:"Łączy twierdzenia, źródła i proweniencję",decisionEngine:"MACIERZ DECYZJI",decisionDesc:"Ocenia priorytet, pewność i rekomendację",riskDesc:"Stosuje politykę przed działaniem o konsekwencjach",missionEngine:"SILNIK MISJI",missionDesc:"Zamienia decyzje w pracę ze stanem",capability:"WARSTWA KOMPETENCJI",capabilityDesc:"Mapuje zatwierdzone misje na kontrolowane działania",outcome:"WYNIK + UCZENIE",outcomeDesc:"Mierzy wyniki i zasila kolejną decyzję",betDesc:"Zdarzenia → analiza → badanie → dowody → decyzja → misja.",growthDesc:"Audyt strony → szansa → Misja Rozwoju → akceptacja → wynik.",spyDesc:"Skan → proweniencja → szansa → KUP / OBSERWUJ / ODRZUĆ → alerty."},
  en:{context:"CONTEXT",evidence:"EVIDENCE",diagnosis:"DIAGNOSIS",decision:"DECISION",governance:"GOVERNANCE",explain:"DECISION EXPLAINABILITY",limits:"The core shows not only the answer, but also the boundaries of its knowledge.",policy:"DECISION POLICY",reversible:"REVERSIBLE ACTION",executionGate:"EXECUTION GATE",missing:"MISSING EVIDENCE",nextEvidence:"NEXT EVIDENCE PACKET",result:"02 / ANALYSIS RESULT",contract:"AGENT CONTRACT",decisionMatrix:"decision matrix",evidenceQuality:"EVIDENCE QUALITY",provenance:"provenance score",riskGate:"RISK GATE",policyScore:"policy assessment",audit:"AUDIT CHAIN",decisionCenter:"DECISION CENTER",reasoning:"REASONING SOURCE",evidenceGraph:"EVIDENCE GRAPH",missionControl:"MISSION CONTROL",currentState:"Current state:",controlled:"controlled transition · demo outcome verification active",learningReady:"LEARNING READY",commercial:"03.5 / COMMERCIAL AGENT CONTRACT",commercialTitle:"From working intelligence",commercialTitle2:"to a product ready to sell.",multiTenant:"Multi-tenant agent infrastructure",multiTenantDesc:"Identity, tenant/workspace isolation, usage metering and plan limits are explicit product contracts. Production durable persistence remains powered by Supabase.",planModel:"PLAN MODEL",riskNote:"High-risk actions require approval · external side effects remain disabled in the demo environment.",intelligence:"03 / INTELLIGENCE LAYER",oneCore:"One core.",seven:"Seven control layers.",productsSurface:"04 / PRODUCT SURFACES",same:"The same intelligence.",three:"Three environments.",decisionIntel:"01 / DECISION INTELLIGENCE",businessOS:"02 / BUSINESS OPERATING SYSTEM",opportunity:"03 / OPPORTUNITY INTELLIGENCE",evidenceLayer:"EVIDENCE LAYER",productCore:"PRODUCT CORE",productLab:"PRODUCT LABORATORY",roadmapTitle:"From a working core",roadmapTitle2:"to a scalable platform.",backTop:"BACK TO TOP ↑",oneCoreMany:"ONE INTELLIGENCE CORE · MANY BUSINESSES",contextEngine:"CONTEXT ENGINE",contextDesc:"Normalizes signals, domain and operating context",evidenceDesc:"Connects claims, sources and provenance",decisionEngine:"DECISION MATRIX",decisionDesc:"Evaluates priority, confidence and recommendation",riskDesc:"Applies policy before consequential action",missionEngine:"MISSION ENGINE",missionDesc:"Turns decisions into stateful work",capability:"CAPABILITY LAYER",capabilityDesc:"Maps approved missions to controlled actions",outcome:"OUTCOME + LEARNING",outcomeDesc:"Measures outcomes and feeds the next decision",betDesc:"Events → analysis → research → evidence → decision → mission.",growthDesc:"Website audit → opportunity → Growth Mission → approval → outcome.",spyDesc:"Scan → provenance → opportunity → BUY / WATCH / PASS → alerts."},
  de:{context:"KONTEXT",evidence:"NACHWEISE",diagnosis:"DIAGNOSE",decision:"ENTSCHEIDUNG",governance:"STEUERUNG",explain:"ENTSCHEIDUNGSERKLÄRUNG",limits:"Der Kern zeigt nicht nur die Antwort, sondern auch die Grenzen seines Wissens.",policy:"ENTSCHEIDUNGSPOLITIK",reversible:"REVERSIBLE AKTION",executionGate:"AUSFÜHRUNGSSCHLEUSE",missing:"FEHLENDE NACHWEISE",nextEvidence:"NÄCHSTES NACHWEISPAKET",result:"02 / ANALYSEERGEBNIS",contract:"AGENTENVERTRAG",decisionMatrix:"Entscheidungsmatrix",evidenceQuality:"NACHWEISQUALITÄT",provenance:"Provenienzbewertung",riskGate:"RISIKOSCHLEUSE",policyScore:"Richtlinienbewertung",audit:"AUDITKETTE",decisionCenter:"ENTSCHEIDUNGSZENTRUM",reasoning:"BEGRÜNDUNGSQUELLE",evidenceGraph:"NACHWEISGRAPH",missionControl:"MISSIONSSTEUERUNG",currentState:"Aktueller Status:",controlled:"kontrollierter Übergang · Verifizierung des Demo-Ergebnisses aktiv",learningReady:"LERNEN BEREIT",commercial:"03.5 / KOMMERZIELLER AGENTENVERTRAG",commercialTitle:"Von funktionierender Intelligenz",commercialTitle2:"zum verkaufsfertigen Produkt.",multiTenant:"Mandantenfähige Agenteninfrastruktur",multiTenantDesc:"Identität, Tenant-/Workspace-Isolation, Nutzungsmetriken und Tariflimits sind explizite Produktverträge. Die dauerhafte Produktionspersistenz bleibt auf Supabase basiert.",planModel:"TARIFMODELL",riskNote:"Hochrisikoaktionen erfordern Freigabe · externe Auswirkungen bleiben in der Demo-Umgebung deaktiviert.",intelligence:"03 / INTELLIGENZSCHICHT",oneCore:"Ein Kern.",seven:"Sieben Steuerungsebenen.",productsSurface:"04 / PRODUKTFLÄCHEN",same:"Dieselbe Intelligenz.",three:"Drei Umgebungen.",decisionIntel:"01 / ENTSCHEIDUNGSINTELLIGENZ",businessOS:"02 / BUSINESS-BETRIEBSSYSTEM",opportunity:"03 / CHANCENINTELLIGENZ",evidenceLayer:"NACHWEISEBENE",productCore:"PRODUKTKERN",productLab:"PRODUKTLABOR",roadmapTitle:"Vom funktionierenden Kern",roadmapTitle2:"zur skalierbaren Plattform.",backTop:"NACH OBEN ↑",oneCoreMany:"EIN INTELLIGENZKERN · VIELE GESCHÄFTE",contextEngine:"KONTEXTENGINE",contextDesc:"Normalisiert Signale, Domäne und Betriebskontext",evidenceDesc:"Verbindet Aussagen, Quellen und Provenienz",decisionEngine:"ENTSCHEIDUNGSMATRIX",decisionDesc:"Bewertet Priorität, Konfidenz und Empfehlung",riskDesc:"Wendet Richtlinien vor folgenreichen Aktionen an",missionEngine:"MISSIONSENGINE",missionDesc:"Macht Entscheidungen zu zustandsbehafteter Arbeit",capability:"KOMPETENZEBENE",capabilityDesc:"Ordnet freigegebene Missionen kontrollierten Aktionen zu",outcome:"ERGEBNIS + LERNEN",outcomeDesc:"Misst Ergebnisse und speist die nächste Entscheidung",betDesc:"Ereignisse → Analyse → Recherche → Nachweise → Entscheidung → Mission.",growthDesc:"Website-Audit → Chance → Growth Mission → Freigabe → Ergebnis.",spyDesc:"Scan → Provenienz → Chance → KAUFEN / BEOBACHTEN / PASSIEREN → Alerts."},
  zh:{context:"上下文",evidence:"证据",diagnosis:"诊断",decision:"决策",governance:"治理",explain:"决策可解释性",limits:"核心不仅展示答案，也展示其知识边界。",policy:"决策策略",reversible:"可逆操作",executionGate:"执行闸门",missing:"缺失证据",nextEvidence:"下一组证据",result:"02 / 分析结果",contract:"智能体契约",decisionMatrix:"决策矩阵",evidenceQuality:"证据质量",provenance:"溯源评分",riskGate:"风险闸门",policyScore:"策略评估",audit:"审计链",decisionCenter:"决策中心",reasoning:"推理来源",evidenceGraph:"证据图",missionControl:"任务控制",currentState:"当前状态：",controlled:"受控过渡 · 演示结果验证已启用",learningReady:"学习就绪",commercial:"03.5 / 商业智能体契约",commercialTitle:"从可运行的智能",commercialTitle2:"到可销售的产品。",multiTenant:"多租户智能体基础设施",multiTenantDesc:"身份、租户/工作区隔离、用量计量和套餐限制均作为明确的产品契约。生产环境的持久化仍由 Supabase 提供。",planModel:"套餐模型",riskNote:"高风险操作需要审批 · 演示环境中的外部副作用保持关闭。",intelligence:"03 / 智能层",oneCore:"一个核心。",seven:"七个控制层。",productsSurface:"04 / 产品界面",same:"同一套智能。",three:"三个环境。",decisionIntel:"01 / 决策智能",businessOS:"02 / 业务操作系统",opportunity:"03 / 机会智能",evidenceLayer:"证据层",productCore:"产品核心",productLab:"产品实验室",roadmapTitle:"从可运行的核心",roadmapTitle2:"到可扩展的平台。",backTop:"返回顶部 ↑",oneCoreMany:"一个智能核心 · 服务多个业务",contextEngine:"上下文引擎",contextDesc:"规范化信号、业务领域和运营上下文",evidenceDesc:"连接主张、来源和溯源",decisionEngine:"决策矩阵",decisionDesc:"评估优先级、置信度和建议",riskDesc:"在产生后果的操作前应用策略",missionEngine:"任务引擎",missionDesc:"将决策转化为有状态的工作",capability:"能力层",capabilityDesc:"将已批准的任务映射为受控操作",outcome:"结果 + 学习",outcomeDesc:"衡量结果并反馈给下一次决策",betDesc:"事件 → 分析 → 研究 → 证据 → 决策 → 任务。",growthDesc:"网站审计 → 机会 → 增长任务 → 审批 → 结果。",spyDesc:"扫描 → 溯源 → 机会 → 购买 / 关注 / 放弃 → 提醒。"}
} as const;
const tx=(key:keyof typeof copy.pl)=>copy[lang][key];
const stageIds = ["OBSERVE", "CONTEXT", "EVIDENCE", "DIAGNOSE", "DECIDE", "MISSION", "APPROVAL", "EXECUTE", "MEASURE", "LEARN"];
const roadmapLabels={pl:[["RDZEŃ","Kontrakt agenta, dowody, decyzje i cykl życia misji"],["PRODUKTY","Bet Builder, Growth Advisor i Extra Szpieg jako powierzchnie dowodowe"],["DANE","Konektory, proweniencja i trwały kontekst biznesowy"],["AUTONOMIA","Zarządzane wykonywanie kompetencji za politykami akceptacji"],["UCZENIE","Informacja zwrotna o wynikach i ponownie użyteczna inteligencja"],["PLATFORMA","Wielodostępność, uwierzytelnianie, pomiar użycia i kontrola enterprise"]],en:[["CORE","Agent contract, evidence, decisions and mission lifecycle"],["PRODUCTS","Bet Builder, Growth Advisor and Extra Szpieg as evidence surfaces"],["DATA","Connectors, provenance and durable business context"],["AUTONOMY","Governed capability execution behind approval policies"],["LEARNING","Outcome feedback and reusable intelligence"],["PLATFORM","Multi-tenancy, authentication, usage metering and enterprise control"]],de:[["KERN","Agentenvertrag, Nachweise, Entscheidungen und Missionslebenszyklus"],["PRODUKTE","Bet Builder, Growth Advisor und Extra Szpieg als Nachweisflächen"],["DATEN","Konnektoren, Provenienz und dauerhafter Geschäftskontext"],["AUTONOMIE","Gesteuerte Kompetenz-Ausführung hinter Freigaberichtlinien"],["LERNEN","Ergebnisfeedback und wiederverwendbare Intelligenz"],["PLATTFORM","Mandantenfähigkeit, Authentifizierung, Nutzungsmetriken und Enterprise-Steuerung"]],zh:[["核心","智能体契约、证据、决策和任务生命周期"],["产品","Bet Builder、Growth Advisor 和 Extra Szpieg 的证据界面"],["数据","连接器、溯源和持久业务上下文"],["自主性","在审批策略下受治理的能力执行"],["学习","结果反馈与可复用智能"],["平台","多租户、身份认证、用量计量和企业级控制"]]} as const;const stageLabels={pl:["OBSERWUJ","KONTEKST","DOWODY","DIAGNOZA","DECYZJA","MISJA","AKCEPTACJA","WYKONANIE","POMIAR","UCZENIE"],en:["OBSERVE","CONTEXT","EVIDENCE","DIAGNOSE","DECIDE","MISSION","APPROVAL","EXECUTE","MEASURE","LEARN"],de:["BEOBACHTEN","KONTEXT","NACHWEISE","DIAGNOSE","ENTSCHEIDUNG","MISSION","FREIGABE","AUSFÜHRUNG","MESSUNG","LERNEN"],zh:["观察","上下文","证据","诊断","决策","任务","审批","执行","衡量","学习"]} as const;

export default function UltraCommandCenter() {
  const [domain, setDomain] = useState<keyof typeof domains>("Growth");
  const [lang, setLang] = useState<UiLang>("pl");
  const t = (key: keyof typeof uiText.pl) => uiText[lang][key];
  const [runtime, setRuntime] = useState<Json | null>(null);
  const [agent, setAgent] = useState<Json | null>(null);
  const [result, setResult] = useState<Json | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [missionBusy, setMissionBusy] = useState(false);
  const [commercial, setCommercial] = useState<Json | null>(null);
  const [agentQuestion, setAgentQuestion] = useState("");
  const [agentAnalysis, setAgentAnalysis] = useState<Json | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentError, setAgentError] = useState("");
  const agentPrompts = [
    "Mamy dużo leadów, ale czas odpowiedzi jest zbyt długi, a współczynnik wygranych transakcji spada. Co powinniśmy zbadać?",
    "Ruch rośnie, ale konwersja zakupów jest słaba. Znajdź prawdopodobne wąskie gardło i zaproponuj pierwszy eksperyment.",
    "Zaległości operacyjne rosną, a zespół jest blisko pełnej przepustowości. Co powinniśmy zdiagnozować przed zwiększeniem zatrudnienia?",
    "Odpływ klientów rośnie. Jak uporządkować analizę i zdecydować, co zmienić jako pierwsze?"
  ];

  useEffect(() => {
    Promise.all([
      fetch("/api/engine", { headers: { Accept: "application/json" } }).then(r => r.json()),
      fetch("/api/agent", { headers: { Accept: "application/json" } }).then(r => r.json()),
      fetch("/api/commercial", { headers: { Accept: "application/json" } }).then(r => r.json())
    ]).then(([engine, agentData, commercialData]) => { setRuntime(engine); setAgent(agentData); setCommercial(commercialData); }).catch(() => { setRuntime(null); setAgent(null); setCommercial(null); });
  }, []);

  const trace = result?.trace ?? [];
  const completed = useMemo(() => {
    const done = new Set(trace.filter((x: Json) => ["GOTOWE", "UTWORZONA", "PRZEJŚCIE"].includes(String(x.status).toUpperCase())).map((x: Json) => String(x.stage).toUpperCase().replace(/[^A-Z]/g, "")));
    if (result?.mission?.id) done.add("MISSION");
    if (["APPROVED", "EXECUTING", "MEASURING", "GOTOWED", "LEARNED"].includes(String(result?.mission?.state))) done.add("APPROVAL");
    if (["EXECUTING", "MEASURING", "GOTOWED", "LEARNED"].includes(String(result?.mission?.state))) done.add("EXECUTE");
    if (["MEASURING", "GOTOWED", "LEARNED"].includes(String(result?.mission?.state))) done.add("MEASURE");
    if (result?.mission?.state === "LEARNED") done.add("LEARN");
    return done;
  }, [trace, result?.mission?.id, result?.mission?.state]);

  async function run() {
    setRunning(true); setError(""); setResult(null);
    const publicProblems: Record<keyof typeof domains, string> = {
      Growth: "Ruch na stronie rośnie, ale konwersja checkout jest słaba. Zdiagnozuj główne wąskie gardło i wskaż pierwszy krok.",
      Sales: "Mamy dużo leadów, ale czas odpowiedzi jest zbyt długi, a współczynnik wygranych transakcji spada. Co należy zbadać najpierw?",
      Operations: "Backlog operacyjny rośnie, a zespół pracuje blisko pełnej przepustowości. Co należy zdiagnozować przed zwiększeniem zatrudnienia?"
    };
    try {
      const r = await fetch("/api/investor-demo", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ problem: publicProblems[domain] }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "BŁĄD ANALIZY AGENTA");
      const confidence = Number(data.solution?.confidence || 0);
      setResult({
        ok: true, engine: "Core Engine AI", version: "public-investor-v1", state: "PRZEANALIZOWANO",
        decision: { recommendation: data.solution?.recommendation, diagnosis: data.solution?.diagnosis, priority: data.solution?.priority, confidence, riskGate: "PRZEJŚCIE", reasoningSource: "Core Engine AI", evidence: data.evidence || [] },
        evidence: data.evidence || [], evidenceQuality: data.evidenceQuality,
        trace: (data.trace || []).map((x: Json) => ({ ...x, status: "GOTOWE" })),
        audit: { algorithm: "Public simulation provenance", integrity: "SIMULATED", chainLength: (data.trace || []).length },
        mission: null, simulation: true
      });
    } catch (e) { setError(e instanceof Error ? e.message : "BŁĄD ANALIZY AGENTA"); }
    finally { setRunning(false); }
  }

  async function analyzeVisitorProblem() {
    const problem = agentQuestion.trim();
    if (problem.length < 12) {
      setAgentError("Opisz problem trochę dokładniej — minimum 12 znaków.");
      return;
    }
    setAgentRunning(true); setAgentError(""); setAgentAnalysis(null);
    try {
      const r = await fetch("/api/investor-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ problem })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "BŁĄD ANALIZY DEMO");
      setAgentAnalysis(data);
    } catch (e) {
      setAgentError(e instanceof Error ? e.message : "BŁĄD ANALIZY DEMO");
    } finally { setAgentRunning(false); }
  }

  async function mission(action: string) {
    if (!result?.mission?.id) return;
    setMissionBusy(true); setError("");
    try {
      const r = await fetch("/api/mission", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ id: result.mission.id, action, idempotencyKey: crypto.randomUUID(), outcome: { before: 100, after: action === "measure" ? 112 : 120, direction: "higher" } }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "BŁĄD OPERACJI MISJI");
      setResult((old: Json) => ({ ...old, ...data, mission: data.mission, state: data.mission?.state, trace: data.trace ?? old.trace }));
    } catch (e) { setError(e instanceof Error ? e.message : "BŁĄD OPERACJI MISJI"); }
    finally { setMissionBusy(false); }
  }

  const state = result?.mission?.state;
  const next = state === "AWAITING_APPROVAL" ? "approve" : state === "APPROVED" ? "execute" : state === "EXECUTING" ? "measure" : state === "MEASURING" ? "complete" : state === "GOTOWED" ? "learn" : "";
  const evidenceScore = result?.evidenceQuality?.score;
  const confidence = Number(result?.decision?.confidence);

  return <section className="ultra-shell" id="top">
    <div className="ultra-noise" />
    <div className="ultra-orbit ultra-o1" /><div className="ultra-orbit ultra-o2" /><div className="ultra-orbit ultra-o3" />
    <header className="ultra-topbar"><div className="ultra-language"><span>LANGUAGE</span><select value={lang} onChange={e => setLang(e.target.value as UiLang)} aria-label="Language"><option value="pl">PL</option><option value="en">EN</option><option value="de">DE</option><option value="zh">中文</option></select></div>
      <div className="ultra-brand"><span><BrainCircuit size={18}/></span><b>{t("core")}</b><small>{t("control")}</small></div>
      <div className="ultra-live"><i /> {t("live")}</div>
      <div className="ultra-toplinks"><a href="#portfolio">{t("products")} <ArrowRight size={13}/></a><a href="#roadmap">{t("roadmap")}</a></div>
    </header>

    <div className="ultra-hero">
      <div className="ultra-kicker"><span>{t("investor")}</span><em>{t("agentEnv")} · {agent?.runtime?.status || "ŁĄCZENIE"}</em></div>
      <h1>{t("hero1")}<br/><span>{t("hero2")}</span></h1>
      <p>{t("heroDesc")}</p>
      <div className="ultra-hero-actions"><a className="ultra-primary" href="#ultra-demo"><Play size={15}/> {t("runCore")}</a><a className="ultra-secondary" href="#ultra-map">{t("systemMap")} <ArrowRight size={14}/></a></div>
      <div className="ultra-proof"><span><ShieldCheck size={14}/> {t("proof1")}</span><span><LockKeyhole size={14}/> {t("proof2")}</span><span><GitBranch size={14}/> {t("proof3")}</span></div>
    </div>

    <section className="ultra-agent-lab" id="agent-lab">
      <div className="ultra-agent-lab-head">
        <div>
          <span className="ultra-label">{t("lab")}</span>
          <h2>{t("labTitle1")}<br/><i>{t("labTitle2")}</i></h2>
          <p>{t("labDesc")}</p>
        </div>
        <div className="ultra-agent-badge"><BrainCircuit size={17}/> {t("publicDemo")} <span>{t("simulation")}</span></div>
      </div>
      <div className="ultra-agent-prompts">
        <span>{t("tryQuestion")}</span>
        {agentPrompts.map((prompt, i) => <button key={i} onClick={() => { setAgentQuestion(prompt); setAgentError(""); }}>{prompt}</button>)}
      </div>
      <div className="ultra-agent-input">
        <textarea
          value={agentQuestion}
          onChange={e => setAgentQuestion(e.target.value)}
          onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") analyzeVisitorProblem(); }}
          placeholder={t("placeholder")}
          maxLength={2400}
          aria-label="Opisz problem biznesowy dla Core Engine"
        />
        <div className="ultra-agent-input-footer">
          <span>{agentQuestion.length}/2400 · Ctrl/Cmd + Enter</span>
          <button onClick={analyzeVisitorProblem} disabled={agentRunning}>
            {agentRunning ? <><Sparkles className="ultra-spin" size={15}/> {t("analyzing")}</> : <><Zap size={15}/> {t("analyze")}</>}
          </button>
        </div>
      </div>
      {agentAnalysis && <div className="ultra-agent-output">
        <div className="ultra-agent-output-top">
          <div><span className="ultra-label">{t("analysis")} · {String(agentAnalysis.domain || "biznes").toUpperCase()}</span><h3>{agentAnalysis.solution?.diagnosis || "Wygenerowana diagnoza"}</h3></div>
          <div className="ultra-agent-confidence"><small>{t("confidence")}</small><b>{Math.round(Number(agentAnalysis.solution?.confidence || 0) * 100)}%</b></div>
        </div>
        <div className="ultra-agent-grid">
          <article><span>{t("recommendation")}</span><strong>{agentAnalysis.solution?.recommendation}</strong></article>
          <article><span>{t("priority")}</span><strong>{agentAnalysis.solution?.priority}</strong><small>Jakość dowodów: {agentAnalysis.evidenceQuality?.score ?? "brak danych"}</small></article>
          <article><span>{t("nextActions")}</span><div>{(agentAnalysis.solution?.actions || []).slice(0, 4).map((a: Json, i: number) => <p key={i}><b>{String(i + 1).padStart(2, "0")}</b>{a.action}</p>)}</div></article>
        </div>
        <div className="ultra-agent-layers"><span>{tx("context")}</span><span>{tx("evidence")}</span><span>{tx("diagnosis")}</span><span>{tx("decision")}</span><span>{tx("governance")}</span></div>
        {agentAnalysis.explainability && <div className="ultra-agent-explainability">
          <div><span className="ultra-label">{tx("explain")}</span><h4>{tx("limits")}</h4></div>
          <div className="ultra-agent-explain-grid">
            <article><small>NIE{t("confidence")}</small><b>{agentAnalysis.explainability.uncertainty}</b><p>Pewność modelu: {Math.round(Number(agentAnalysis.explainability.confidence || 0) * 100)}%</p></article>
            <article><small>{tx("policy")}</small><b>{tx("reversible")}</b><p>{agentAnalysis.explainability.policy}</p></article>
            <article><small>{tx("executionGate")}</small><b>{agentAnalysis.explainability.execution}</b></article>
          </div>
          <div className="ultra-agent-gaps"><div><small>{tx("missing")}</small>{(agentAnalysis.explainability.evidenceGaps || []).map((x: string, i: number) => <p key={i}><b>{String(i + 1).padStart(2, "0")}</b>{x}</p>)}</div><div><small>{tx("nextEvidence")}</small>{(agentAnalysis.explainability.nextEvidence || []).map((x: string, i: number) => <p key={i}><b>{String(i + 1).padStart(2, "0")}</b>{x}</p>)}</div></div>
        </div>}
        <div className="ultra-agent-trace">{(agentAnalysis.trace || []).map((x: Json) => <span key={x.stage}><i/>{({OBSERVE:"OBSERWUJ",CONTEXT:"KONTEKST",EVIDENCE:"DOWODY",DIAGNOSE:"DIAGNOZA",DECIDE:"DECYZJA",APPROVAL:"AKCEPTACJA",MISSION:"MISJA",EXECUTE:"WYKONANIE",MEASURE:"POMIAR",LEARN:"UCZENIE"} as Record<string,string>)[x.stage] || x.stage}</span>)}</div>
        <small className="ultra-agent-disclaimer">{agentAnalysis.disclaimer}</small>
      </div>}
      {agentError && <div className="ultra-error">DEMO AGENTA · {agentError}</div>}
    </section>

    <div className="ultra-command" id="ultra-demo">
      <div className="ultra-command-head"><div><span className="ultra-label">{t("command")}</span><h2>{t("commandTitle")}</h2></div><div className="ultra-runtime"><i/>{agent?.runtime?.status || runtime?.status || "ŁĄCZENIE"} <b>{runtime?.version || "RDZEŃ"}</b></div></div>
      <div className="ultra-input-grid">
        <div className="ultra-domain-tabs">{(Object.keys(domains) as Array<keyof typeof domains>).map(d => <button key={d} onClick={() => setDomain(d)} className={d === domain ? "active" : ""}><Activity size={14}/>{{Growth:"Rozwój",Sales:"Sprzedaż",Operations:"Operacje"}[d]}</button>)}</div>
        <div className="ultra-signals">{domains[domain].map(s => <div key={s.name}><small>{s.source}</small><b>{s.name}</b><strong>{s.value}</strong></div>)}</div>
        <button className="ultra-run" onClick={run} disabled={running}>{running ? <><Sparkles className="ultra-spin" size={16}/> {t("analyzing")}</> : <><Zap size={16}/> {t("activate")}</>}</button>
      </div>

      <div className="ultra-statebar">
        {stageLabels[lang].map((stage, i) => <div key={stage} className={completed.has(["OBSERVE","CONTEXT","EVIDENCE","DIAGNOSE","DECIDE","MISSION","APPROVAL","EXECUTE","MEASURE","LEARN"][i]) ? "done" : ""}><span>{completed.has(["OBSERVE","CONTEXT","EVIDENCE","DIAGNOSE","DECIDE","MISSION","APPROVAL","EXECUTE","MEASURE","LEARN"][i]) ? <CheckCircle2 size={13}/> : <Circle size={13}/>}</span><b>{stage}</b>{i < stages.length - 1 && <i/>}</div>)}
      </div>

      {result && <div className="ultra-results">
        <div className="ultra-result-head"><div><span className="ultra-label">{tx("result")}</span><h2>{result.engine || "RDZEŃ SILNIK"}<small> · {result.version || "środowisko"}</small></h2></div><div className="ultra-state"><i/>{result.state || "PRZEANALIZOWANO"}</div></div>
        <div className="ultra-agent-strip"><span>{tx("contract")}</span><b>{agent?.agent?.name || "Agent Core Engine"}</b><small>{agent?.agent?.contract || "kontrakt-runtime"} · {agent?.agent?.autonomy || "WYMAGA AKCEPTACJI CZŁOWIEKA"} · {agent?.runtime?.persistence || "trwałość runtime"} · {agent?.runtime?.capabilityPacks ?? 0} pakiety kompetencji · zewnętrzne skutki {agent?.runtime?.liveExternalSideEffects ? "aktywne" : "wyłączone"}</small></div><div className="ultra-metrics">
          <div><small>{t("confidence")}</small><strong>{Number.isFinite(confidence) ? `${Math.round(confidence * 100)}%` : "brak danych"}</strong><span>{tx("decisionMatrix")}</span></div>
          <div><small>{tx("evidenceQuality")}</small><strong>{typeof evidenceScore === "number" ? `${evidenceScore}` : "brak danych"}</strong><span>{tx("provenance")}</span></div>
          <div><small>{tx("riskGate")}</small><strong>{result.decision?.riskGate || "PRZEJŚCIE"}</strong><span>{tx("policyScore")}</span></div>
          <div><small>{tx("audit")}</small><strong>{result.audit?.chainLength ?? 0}</strong><span>{result.audit?.integrity || "oczekuje"}</span></div>
        </div>
        <div className="ultra-decision"><div className="ultra-decision-main"><span className="ultra-label">{tx("decisionCenter")}</span><h3>{result.decision?.recommendation || "Wygenerowana decyzja"}</h3><p>{result.decision?.diagnosis || "Rdzeń przetworzył dostarczone sygnały."}</p></div><div className="ultra-decision-side"><small>{lang === "pl" ? "PRIORYTET" : lang === "de" ? "PRIORITÄT" : lang === "zh" ? "优先级" : "PRIORITY"}</small><b>{result.decision?.priority || "brak danych"}</b><small>{tx("reasoning")}</small><b>{result.decision?.reasoningSource || "Rdzeń"}</b></div></div>
        <div className="ultra-evidence"><div className="ultra-label">{tx("evidenceGraph")}</div>{(result.decision?.evidence || result.evidence || []).slice(0, 8).map((e: any, i: number) => <div key={typeof e === "string" ? e : e.id || i}><span>{String(i + 1).padStart(2,"0")}</span><b>{typeof e === "string" ? e : e.claim || e.id || "węzeł dowodowy"}</b><small>{typeof e === "string" ? "zweryfikowany węzeł" : e.source ? ({analytics:"analityka",funnel:"lejek",CRM:"CRM",sales:"sprzedaż",operations:"operacje",workforce:"zasoby zespołu",ERP:"ERP"} as Record<string,string>)[e.source] || e.source : "brak źródła"}</small></div>)}</div>
        {result.mission && <div className="ultra-mission"><div><span className="ultra-label">{tx("missionControl")}</span><h3>{result.mission.objective}</h3><p>{tx("currentState")} <b>{state}</b> · {tx("controlled")}</p></div><div className="ultra-mission-actions">{next ? <button onClick={() => mission(next)} disabled={missionBusy}>{missionBusy ? <Sparkles className="ultra-spin" size={14}/> : <ArrowRight size={14}/>} {missionBusy ? "PRZETWARZANIE" : next.toUpperCase()}</button> : <span><CheckCircle2 size={15}/> {tx("learningReady")}</span>}</div></div>}
        {result.audit && <div className="ultra-audit"><div><span className="ultra-label">{tx("audit")}</span><h3>{result.audit.algorithm || "Proweniencja kryptograficzna"}</h3></div><code>HEAD · {result.audit.head || "brak danych"}</code><b>{result.audit.integrity}</b></div>}
      </div>}
      {error && <div className="ultra-error">BŁĄD RDZENIA · {error}</div>}
    </div>

    <div className="ultra-commercial" id="commercial">
      <div className="ultra-section-title"><span>03.5 / KOMERCYJNY {tx("contract")}</span><h2>{tx("commercialTitle")}<br/><i>{tx("commercialTitle2")}</i></h2></div>
      <div className="ultra-commercial-grid">
        <div className="ultra-commercial-card">
          <span className="ultra-label">KOMERCYJNE ŚRODOWISKO · {commercial?.contract || "commercial-agent-v1"}</span>
          <h3>{tx("multiTenant")}</h3>
          <p>{tx("multiTenantDesc")}</p>
          <div className="ultra-commercial-status"><b>{commercial?.product?.identity === "SUPABASE_AUTH" ? "UWIERZYTELNIANIE SUPABASE" : (commercial?.product?.identity || "brak danych")}</b><b>{commercial?.product?.tenancy === "TENANT_WORKSPACE" ? "PRZESTRZEŃ TENANTA" : (commercial?.product?.tenancy || "brak danych")}</b><b>{commercial?.product?.metering === "DATABASE_ENFORCED" ? "POMIAR Z BAZY DANYCH" : (commercial?.product?.metering || "brak danych")}</b><b>{commercial?.product?.billing === "INTERNAL_PLAN_V1" ? "PLAN WEWNĘTRZNY V1" : (commercial?.product?.billing || "brak danych")}</b></div>
        </div>
        <div className="ultra-commercial-card">
          <span className="ultra-label">{tx("planModel")}</span>
          <div className="ultra-plans">{(commercial?.plans || []).map((plan: Json) => <div key={plan.id}><b>{String(plan.id).toUpperCase()}</b><strong>{plan.monthlyUnits === null ? "INDYWIDUALNY" : String(plan.monthlyUnits) + " jednostek"}</strong></div>)}</div>
          <small>{tx("riskNote")}</small>
        </div>
      </div>
    </div>

    <div className="ultra-map" id="ultra-map">
      <div className="ultra-section-title"><span>{tx("intelligence")}</span><h2>{tx("oneCore")}<br/><i>{tx("seven")}</i></h2></div>
      <div className="ultra-layer-stack">{[["01","contextEngine","contextDesc",Database],["02","evidenceGraph","evidenceDesc",Radar],["03","decisionEngine","decisionDesc",Gauge],["04","riskGate","riskDesc",ShieldCheck],["05","missionEngine","missionDesc",Target],["06","capability","capabilityDesc",Zap],["07","outcome","outcomeDesc",BrainCircuit]].map(([n,k,d,Icon]) => <article key={n as string}><span>{n as string}</span><Icon size={18}/><div><b>{tx(k as keyof typeof copy.pl)}</b><p>{tx(d as keyof typeof copy.pl)}</p></div><ArrowRight size={14}/></article>)}</div>
    </div>

    <div className="ultra-portfolio" id="portfolio">
      <div className="ultra-section-title"><span>{tx("productsSurface")}</span><h2>{tx("same")}<br/><i>{tx("three")}</i></h2></div>
      <div className="ultra-products">
        <article className="u-orange"><Target/><small>{tx("decisionIntel")}</small><h3>Bet Builder</h3><p>{tx("betDesc")}</p><b>{tx("evidenceLayer")}</b></article>
        <article className="u-violet"><Gauge/><small>{tx("businessOS")}</small><h3>Growth Advisor</h3><p>{tx("growthDesc")}</p><b>{tx("productCore")}</b></article>
        <article className="u-green"><Radar/><small>{tx("opportunity")}</small><h3>Extra Szpieg</h3><p>{tx("spyDesc")}</p><b>{tx("productLab")}</b></article>
      </div>
    </div>

    <div className="ultra-roadmap" id="roadmap"><div className="ultra-section-title"><span>05 / {t("roadmap")} PLATFORMY</span><h2>{tx("roadmapTitle")}<br/><i>{tx("roadmapTitle2")}</i></h2></div><div className="ultra-roadmap-grid">{roadmapLabels[lang].map(([t,d],i) => <article key={t}><span>{String(i+1).padStart(2,"0")}</span><b>{t}</b><p>{d}</p><i/></article>)}</div></div><footer className="ultra-footer"><div><BrainCircuit size={17}/> {lang === "pl" ? "RDZEŃ SILNIK AI" : lang === "de" ? "CORE ENGINE AI" : lang === "zh" ? "核心引擎 AI" : "CORE ENGINE AI"}</div><span>{tx("oneCoreMany")}</span><a href="#top">{tx("backTop")}</a></footer>
  </section>;
}
