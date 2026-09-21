"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BrainCircuit, Building2, Camera, Check, ChevronRight, Cpu, FileSearch, Flame, Globe2, LockKeyhole, Network, Radar, ShieldCheck, Sparkles } from "lucide-react";
import styles from "./alert.module.css";

const sectors = [
  { id: "industrial", title: "Przemysł", text: "hale, produkcja, magazyny, infrastruktura krytyczna", icon: Building2 },
  { id: "commercial", title: "Biznes", text: "biura, handel, hotele, obiekty komercyjne", icon: Globe2 },
  { id: "public", title: "Instytucje", text: "urzędy, szkoły, sądy i obiekty publiczne", icon: ShieldCheck }
];

const stack = [
  ["01", "CCTV + AI", "detekcja, analityka obrazu, LPR/ANPR, weryfikacja zdarzeń", Camera],
  ["02", "SSWiN", "ochrona obwodowa, włamanie i napad, modernizacja istniejących systemów", Radar],
  ["03", "KD + RCP", "tożsamość, drzwi, strefy, czas pracy i integracja z procesami", LockKeyhole],
  ["04", "PPOŻ / SSP", "sygnalizacja pożarowa, bezpieczeństwo ludzi i ciągłość działania", Flame],
  ["05", "LAN / światłowód", "infrastruktura sieciowa, PoE, rack, transmisja i odporność", Network],
  ["06", "IT + integracja", "połączenie security, IT, OT, monitoringu i automatyzacji", Cpu]
] as const;

const lifecycle = ["AUDYT", "PROJEKT", "WDROŻENIE", "URUCHOMIENIE", "SERWIS", "MODERNIZACJA", "ROZWÓJ"];

const forecast = [
  { year: "2026", base: 100, growth: 100 },
  { year: "2027", base: 112, growth: 118 },
  { year: "2028", base: 126, growth: 142 },
  { year: "2029", base: 141, growth: 171 },
  { year: "2030", base: 158, growth: 205 }
];

export default function AlertPage() {
  const [sector, setSector] = useState("industrial");
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditSent, setAuditSent] = useState(false);
  const [surface, setSurface] = useState("Hala produkcyjna");
  const [area, setArea] = useState("5000");
  const [systems, setSystems] = useState<string[]>(["CCTV", "SSWiN"]);
  const [progress, setProgress] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const selectedSector = useMemo(() => sectors.find((x) => x.id === sector) ?? sectors[0], [sector]);
  useEffect(() => {
    const onScroll = () => { const max = document.documentElement.scrollHeight - window.innerHeight; setProgress(max > 0 ? (window.scrollY / max) * 100 : 0); };
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  function toggleSystem(value: string) { setSystems((current) => current.includes(value) ? current.filter((x) => x !== value) : [...current, value]); }

  return <main className={styles.page}>
    <header className={styles.header}>
      <a className={styles.brand} href="#top" aria-label="ALERT Security home"><span className={styles.logoMark} aria-hidden="true"><span/><span/><span/></span><span><b>ALERT</b><small>SECURITY ENGINEERING</small></span></a>
      <nav className={styles.nav}><a href="#rozwiazania">Rozwiązania</a><a href="#technologie">Technologie</a><a href="#realizacje">Realizacje</a><a href="#strategia">Strategia</a><a href="#kontakt">Kontakt</a></nav><button className={styles.menuButton} onClick={()=>setMenuOpen((v)=>!v)} aria-label="Otwórz menu"><span/><span/></button>
      <div className={styles.headerRight}><span className={styles.engineStatus}><i/> ENGINE ONLINE</span><a className={styles.headerCta} href="#audyt">AUDYT OBIEKTU <ArrowRight size={15}/></a></div>{menuOpen&&<div className={styles.mobileMenu}><a href="#rozwiazania" onClick={()=>setMenuOpen(false)}>Rozwiązania</a><a href="#technologie" onClick={()=>setMenuOpen(false)}>Technologie</a><a href="#realizacje" onClick={()=>setMenuOpen(false)}>Realizacje</a><a href="#strategia" onClick={()=>setMenuOpen(false)}>Strategia</a><a href="#kontakt" onClick={()=>setMenuOpen(false)}>Kontakt</a></div>}
    </header>

    <section id="top" className={styles.hero}>
      <div className={styles.heroGrid}/><div className={styles.heroGlow}/>
      <div className={styles.heroCopy}>
        <div className={styles.eyebrow}><span/> TECHNICAL SECURITY · SINCE 1990 <i/></div>
        <h1>Bezpieczeństwo obiektu. <em>Od projektu do ciągłości.</em></h1>
        <p>Projektujemy, integrujemy i serwisujemy systemy bezpieczeństwa, teletechniki i infrastruktury IT dla przemysłu, biznesu i instytucji.</p>
        <div className={styles.heroActions}><a className={styles.primary} href="#audyt">Zaprojektuj zabezpieczenie <ArrowRight size={17}/></a><a className={styles.secondary} href="#technologie">Poznaj Security Stack <ChevronRight size={17}/></a></div>
        <div className={styles.trustLine}><span><Check size={13}/> 36 lat doświadczenia</span><span><Check size={13}/> Zabrze · Górny Śląsk</span><span><Check size={13}/> Projekt · montaż · serwis</span></div>
      </div>
      <div className={styles.heroSystem}>
        <div className={styles.systemTop}><span>ALERT SECURITY ENGINE</span><b>LIVE ARCHITECTURE</b></div>
        <div className={styles.systemCore}><BrainCircuit size={38}/><strong>OBJECT<br/>SECURITY</strong><small>RISK → CONTROL → RESPONSE</small></div>
        {[["CCTV","AI ANALYTICS","99.2%"],["ACCESS","IDENTITY","ACTIVE"],["SSWiN","PERIMETER","ARMED"],["NETWORK","IT / OT","SECURE"]].map(([a,b,c],i)=><div className={styles.systemNode} key={a} style={{["--i" as string]:i}}><span>{a}</span><small>{b}</small><b>{c}</b></div>)}
        <div className={styles.systemRing}/>
      </div>
    </section>

    <section className={styles.legacy}><div><span className={styles.kicker}>DOŚWIADCZENIE, KTÓRE PRACUJE</span><strong>1990</strong><small>początek działalności</small></div><div><strong>1996</strong><small>ALERT w Zabrzu</small></div><div><strong>36+</strong><small>lat w technicznej ochronie</small></div><div><strong>B2B</strong><small>przemysł · handel · instytucje</small></div><div className={styles.legacyText}>Makro · bankowość · Poczta Polska · sądy · administracja</div></section>

    <section id="rozwiazania" className={styles.section}>
      <div className={styles.sectionIntro}><span className={styles.kicker}>01 · BUSINESS SECURITY ARCHITECTURE</span><h2>Nie sprzedajemy urządzeń. <em>Projektujemy system.</em></h2><p>Łączymy bezpieczeństwo fizyczne, sieć, automatykę i dane w jeden zarządzalny ekosystem.</p></div>
      <div className={styles.sectorTabs}>{sectors.map((item)=>{const Icon=item.icon;return <button key={item.id} className={sector===item.id?styles.activeTab:""} onClick={()=>setSector(item.id)}><Icon size={18}/><b>{item.title}</b><small>{item.text}</small></button>})}</div>
      <div className={styles.sectorPanel}><div><span className={styles.liveTag}>RECOMMENDED ARCHITECTURE</span><h3>{selectedSector.title}: zintegrowany model ochrony</h3><p>Od analizy ryzyka po serwis. Dobór technologii zależy od obiektu, procesów, wymagań i istniejącej infrastruktury.</p></div><div className={styles.archFlow}>{["OBSERVE","DETECT","VERIFY","RESPOND","LEARN"].map((x,i)=><div key={x}><span>0{i+1}</span><b>{x}</b>{i<4&&<ArrowRight size={14}/>}</div>)}</div></div>
    </section>

    <section id="technologie" className={styles.section+" "+styles.darkSection}>
      <div className={styles.sectionIntro}><span className={styles.kicker}>02 · SECURITY STACK</span><h2>Jedna architektura. <em>Wiele warstw ochrony.</em></h2><p>Nowoczesne bezpieczeństwo przesuwa się w stronę integracji IT, OT, edge AI, chmury i systemów fizycznych.</p></div>
      <div className={styles.stackGrid}>{stack.map(([num,title,text,Icon])=><article key={num}><span>{num}</span><Icon size={20}/><h3>{title}</h3><p>{text}</p><ChevronRight size={16}/></article>)}</div>
    </section>

    <section className={styles.aiSection}>
      <div className={styles.aiVisual}><div className={styles.aiOrbit}/><div className={styles.aiCore}><Sparkles size={28}/><b>AI</b><small>SECURITY<br/>ARCHITECT</small></div>{["CCTV","KD","SSWiN","PPOŻ","LAN","IT"].map((x,i)=><span key={x} className={styles.aiNode} style={{["--n" as string]:i}}>{x}</span>)}</div>
      <div className={styles.aiCopy}><span className={styles.kicker}>04 · ALERT AI SECURITY ARCHITECT</span><h2>Opisz obiekt. <em>Engine buduje architekturę.</em></h2><p>Cyfrowy doradca ALERT przyjmuje opis obiektu, istniejące systemy i problem. Engine tworzy profil ryzyka, zakres technologii, priorytety i pytania dla inżyniera.</p><div className={styles.aiSteps}>{["Profil obiektu","Mapa ryzyka","Security Stack","Plan modernizacji"].map((x,i)=><div key={x}><span>0{i+1}</span><b>{x}</b><ChevronRight size={14}/></div>)}</div><a className={styles.primary} href="#audyt">Uruchom koncepcję audytu <ArrowRight size={16}/></a></div>
    </section>

    <section id="audyt" className={styles.auditSection}>
      <div className={styles.auditCopy}><span className={styles.kicker}>05 · DIGITAL LEAD ENGINE</span><h2>Security Audit <em>przed pierwszym telefonem.</em></h2><p>Interaktywny formularz kwalifikuje obiekt i tworzy wstępny brief dla zespołu ALERT. W wersji produkcyjnej dane trafiają do Core Engine, a każda rekomendacja otrzymuje dowód, priorytet i następny krok.</p><div className={styles.auditPills}><span>Risk profile</span><span>Technology gaps</span><span>Modernization</span><span>Priority 1–3</span></div></div>
      <div className={styles.auditCard}><div className={styles.auditHeader}><span>OBJECT INTAKE</span><b>CORE ENGINE READY</b></div>
        <label>Typ obiektu<select value={surface} onChange={(e)=>setSurface(e.target.value)}><option>Hala produkcyjna</option><option>Magazyn</option><option>Biurowiec</option><option>Hotel</option><option>Obiekt publiczny</option></select></label>
        <label>Powierzchnia (m²)<input value={area} onChange={(e)=>setArea(e.target.value)} inputMode="numeric"/></label>
        <div className={styles.checkGrid}>{["CCTV","SSWiN","KD","RCP","PPOŻ","LAN"].map(x=><button key={x} className={systems.includes(x)?styles.checked:""} onClick={()=>toggleSystem(x)}><Check size={13}/>{x}</button>)}</div>
        <button className={styles.auditButton} onClick={()=>{setAuditSent(true);setAuditOpen(true)}}><FileSearch size={16}/>{auditSent?"BRIEF UTWORZONY":"UTWÓRZ WSTĘPNY BRIEF"}<ArrowRight size={15}/></button>
        {auditOpen&&<div className={styles.auditResult}><div><span>PROFILE</span><b>{surface}</b></div><div><span>SCOPE</span><b>{systems.join(" · ")||"Do określenia"}</b></div><div><span>PRIORITY</span><b>{Number(area)>3000?"MODERNIZACJA / INTEGRACJA":"BASIC + GROWTH"}</b></div><small>Demo UX. Produkcyjnie: zapis do Core Engine → mission → human approval → oferta.</small></div>}
      </div>
    </section>

    <section id="realizacje" className={styles.section}><div className={styles.sectionIntro}><span className={styles.kicker}>06 · PROOF OF DELIVERY</span><h2>Historia nie jest archiwum. <em>To przewaga sprzedażowa.</em></h2><p>ALERT posiada doświadczenie m.in. w Makro, bankowości, Poczcie Polskiej, zakładach karnych, sądzie i administracji publicznej.</p></div><div className={styles.caseGrid}>{[["PRZEMYSŁ","Hale i produkcja","CCTV · SSWiN · KD · LAN"],["HANDEL","Obiekty wielkopowierzchniowe","CCTV · analityka · kontrola"],["PUBLIC","Instytucje i administracja","SSP · CCTV · KD · sieci"],["MODERNIZACJA","Istniejące instalacje","audyt · etapowanie · serwis"]].map(([tag,title,desc])=><article key={tag}><span>{tag}</span><h3>{title}</h3><p>{desc}</p><a href="#kontakt">Zobacz model realizacji <ArrowRight size={14}/></a></article>)}</div></section>

    <section id="strategia" className={styles.section+" "+styles.strategy}><div className={styles.sectionIntro}><span className={styles.kicker}>07 · BUSINESS DEVELOPMENT ENGINE</span><h2>Od instalatora do <em>regionalnego integratora security.</em></h2><p>Proponowana ścieżka rozwoju opiera się na integracji, AI, hybrydowych wdrożeniach, modernizacji legacy i usługach lifecycle.</p></div><div className={styles.strategyGrid}>{[["01","POSITIONING","ALERT = integrator bezpieczeństwa obiektu","Przestać komunikować katalog usług jako główną wartość."],["02","VERTICALS","Przemysł · magazyny · handel · public","Budować osobne rozwiązania, case studies i kampanie."],["03","RECURRING","Serwis + SLA + modernizacja","Przejść z jednorazowego CAPEX do relacji lifecycle."],["04","AI","Security Audit + Architect","Zamienić stronę w narzędzie kwalifikacji leadów."],["05","PARTNERS","Axis · Genetec · Bosch · JCI · integracje","Budować kompetencje ekosystemowe zamiast zależności od jednego producenta."],["06","EXPANSION","Górny Śląsk → Polska południowa","Skalować sprzedaż przez vertical playbooks i partnerstwa."]].map(([n,t,h,p])=><article key={n}><span>{n} · {t}</span><h3>{h}</h3><p>{p}</p></article>)}</div></section>

    <section className={styles.forecast}><div><span className={styles.kicker}>08 · STRATEGIC SCENARIO MODEL</span><h2>Przychód nie musi rosnąć przez <em>więcej montaży.</em></h2><p>Indeks 100 oznacza poziom bazowy 2026. To scenariusz ilustracyjny do planowania, nie prognoza finansowa ALERT. Model pokazuje różnicę między rozwojem głównie instalacyjnym a strategią integratora opartą o serwis, modernizację i AI-assisted sales.</p><div className={styles.forecastLegend}><span><i className={styles.violetDot}/> Instalacje + tradycyjna sprzedaż</span><span><i className={styles.orangeDot}/> Integrator + lifecycle + AI</span></div></div><div className={styles.forecastChart}>{forecast.map((x)=><div className={styles.chartRow} key={x.year}><span>{x.year}</span><div><i style={{width:(x.base/2)+"%"}}/><b style={{width:(x.growth/2)+"%"}}/></div><strong>{x.growth}</strong></div>)}<small>Indeks strategiczny, baza 2026 = 100</small></div></section>

    <section className={styles.lifecycle}><div className={styles.sectionIntro}><span className={styles.kicker}>09 · SECURITY LIFECYCLE</span><h2>Klient powinien zostać z ALERT <em>po instalacji.</em></h2></div><div className={styles.lifecycleRail}>{lifecycle.map((x,i)=><div key={x}><span>0{i+1}</span><b>{x}</b>{i<lifecycle.length-1&&<ArrowRight size={14}/>}</div>)}</div></section>

    <section className={styles.future}><div className={styles.futureCard}><span className={styles.kicker}>THE NEW ALERT</span><h2>Security technology partner. <em>Not another installer.</em></h2><p>ALERT ma aktywa potrzebne do przejścia wyżej w łańcuchu wartości: historia od 1990 roku, kompetencje techniczne, szeroki stack, serwis i referencje. Następny etap to produktowa komunikacja, specjalizacja verticalowa, recurring revenue i własna warstwa cyfrowa.</p><div className={styles.futureGrid}><span>ENGINEERING</span><span>INTEGRATION</span><span>AI</span><span>SERVICE</span><span>MODERNIZATION</span><span>DATA</span></div></div></section>

    <section id="kontakt" className={styles.contact}><div><span className={styles.kicker}>10 · NEXT MOVE</span><h2>Masz obiekt. <em>ALERT buduje plan.</em></h2><p>Proponowany pierwszy krok biznesowy: bezpłatny audyt obecnej infrastruktury + mapa modernizacji + plan działań sprzedażowych.</p></div><div className={styles.contactActions}><a className={styles.primary} href="tel:+48322761320">Porozmawiaj z ALERT <ArrowRight size={16}/></a><a className={styles.secondary} href="mailto:alert@alert.net.pl">alert@alert.net.pl <ArrowRight size={16}/></a></div></section>
    <footer className={styles.footer}><div className={styles.brand}><span className={styles.logoMark}><span/><span/><span/></span><span><b>ALERT</b><small>SECURITY ENGINEERING</small></span></div><span>Myśliwska 69 · 41-800 Zabrze · od 1990</span><span>Technical Security · Teletechnika · IT</span></footer>
  </main>;
}
