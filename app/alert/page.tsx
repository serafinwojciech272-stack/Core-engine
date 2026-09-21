"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BrainCircuit, Building2, Camera, Check, ChevronRight, Cpu, FileSearch, Flame, Globe2, LockKeyhole, Network, Radar, ShieldCheck, Sparkles, Target, Activity, Zap } from "lucide-react";
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

export default function AlertPage() {
  const [sector, setSector] = useState("industrial");
  const [auditOpen, setAuditOpen] = useState(false);
  const [surface, setSurface] = useState("Hala produkcyjna");
  const [area, setArea] = useState("5000");
  const [systems, setSystems] = useState<string[]>(["CCTV", "SSWiN"]);
  const [progress, setProgress] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const selectedSector = useMemo(() => sectors.find((x) => x.id === sector) ?? sectors[0], [sector]);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? (window.scrollY / max) * 100 : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function toggleSystem(value: string) {
    setSystems((current) => current.includes(value) ? current.filter((x) => x !== value) : [...current, value]);
  }

  function createMission() {
    setAuditOpen(true);
    document.getElementById("misja")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return <main className={styles.page}>
    <div className={styles.scrollProgress} style={{ width: progress + "%" }} />

    <header className={styles.header}>
      <a className={styles.brand} href="#top" aria-label="ALERT Security home">
        <span className={styles.logoMark} aria-hidden="true"><span/><span/><span/></span>
        <span><b>ALERT</b><small>SECURITY ENGINEERING</small></span>
      </a>
      <nav className={styles.nav}>
        <a href="#rozwiazania">Rozwiązania</a><a href="#technologie">Technologie</a><a href="#audyt">Audyt</a><a href="#misje">Misje</a><a href="#kontakt">Kontakt</a>
      </nav>
      <button className={styles.menuButton} onClick={() => setMenuOpen(v => !v)} aria-label="Otwórz menu"><span/><span/></button>
      <div className={styles.headerRight}>
        <span className={styles.engineStatus}><i/> ENGINE ONLINE</span>
        <a className={styles.headerCta} href="#audyt">AUDYT OBIEKTU <ArrowRight size={15}/></a>
      </div>
      {menuOpen && <div className={styles.mobileMenu}>
        {["rozwiazania","technologie","audyt","misje","kontakt"].map((x) => <a key={x} href={"#" + x} onClick={() => setMenuOpen(false)}>{x === "rozwiazania" ? "Rozwiązania" : x === "technologie" ? "Technologie" : x === "audyt" ? "Audyt" : x === "misje" ? "Misje" : "Kontakt"}</a>)}
      </div>}
    </header>

    <div className={styles.signalBar}><i/> ZABRZE · GÓRNY ŚLĄSK <i/> SECURITY ENGINEERING <i/> OD 1990 <i/> PROJEKT · MONTAŻ · SERWIS <i/> AUDYT → ARCHITEKTURA → CIĄGŁOŚĆ</div>

    <section id="top" className={styles.hero}>
      <div className={styles.heroGrid}/><div className={styles.heroGlow}/>
      <div className={styles.heroCopy}>
        <div className={styles.eyebrow}><span/> TECHNICAL SECURITY · ZABRZE · SINCE 1990 <i/></div>
        <h1>Bezpieczeństwo obiektu. <em>Od projektu do ciągłości.</em></h1>
        <p>Projektujemy, integrujemy i serwisujemy systemy bezpieczeństwa, teletechniki i infrastruktury IT dla przemysłu, biznesu i instytucji.</p>
        <div className={styles.heroActions}><a className={styles.primary} href="#audyt">Zaprojektuj zabezpieczenie <ArrowRight size={17}/></a><a className={styles.secondary} href="#technologie">Poznaj Security Stack <ChevronRight size={17}/></a></div>
        <div className={styles.trustLine}><span><Check size={13}/> 36 lat doświadczenia</span><span><Check size={13}/> Myśliwska 69 · Zabrze</span><span><Check size={13}/> Projekt · montaż · serwis</span></div>
      </div>
      <div className={styles.heroSystem}>
        <div className={styles.systemTop}><span>ALERT SECURITY ENGINE</span><b>LIVE OBJECT ARCHITECTURE</b></div>
        <div className={styles.systemCore}><BrainCircuit size={38}/><strong>OBJECT<br/>SECURITY</strong><small>RISK → CONTROL → RESPONSE</small></div>
        {[["CCTV","AI ANALYTICS","ACTIVE"],["ACCESS","IDENTITY","ACTIVE"],["SSWiN","PERIMETER","ARMED"],["NETWORK","IT / OT","SECURE"]].map(([a,b,c],i)=><div className={styles.systemNode} key={a} style={{["--i" as string]:i}}><span>{a}</span><small>{b}</small><b>{c}</b></div>)}
        <div className={styles.systemRing}/><div className={styles.scanLine}/>
      </div>
    </section>

    <section className={styles.legacy}><div><span className={styles.kicker}>DZIEDZICTWO</span><strong>1990</strong><small>początek działalności</small></div><div><strong>1996</strong><small>ALERT w Zabrzu</small></div><div><strong>36+</strong><small>lat doświadczenia</small></div><div><strong>B2B</strong><small>przemysł · handel · instytucje</small></div><div className={styles.legacyText}>Makro · bankowość · Poczta Polska · sądy · administracja</div></section>

    <section id="rozwiazania" className={styles.section}>
      <div className={styles.sectionIntro}><span className={styles.kicker}>01 · BUSINESS SECURITY ARCHITECTURE</span><h2>Nie sprzedajemy urządzeń. <em>Projektujemy system.</em></h2><p>Łączymy bezpieczeństwo fizyczne, sieć, automatykę i dane w jeden zarządzalny ekosystem.</p></div>
      <div className={styles.sectorTabs}>{sectors.map(item => { const Icon=item.icon; return <button key={item.id} className={sector===item.id ? styles.activeTab : ""} onClick={() => setSector(item.id)}><Icon size={18}/><b>{item.title}</b><small>{item.text}</small></button>; })}</div>
      <div className={styles.sectorPanel}><div><span className={styles.liveTag}>RECOMMENDED ARCHITECTURE</span><h3>{selectedSector.title}: zintegrowany model ochrony</h3><p>Od analizy ryzyka po serwis. Dobór technologii zależy od obiektu, procesów, wymagań i istniejącej infrastruktury.</p></div><div className={styles.archFlow}>{["OBSERVE","DETECT","VERIFY","RESPOND","LEARN"].map((x,i)=><div key={x}><span>0{i+1}</span><b>{x}</b>{i<4&&<ArrowRight size={14}/>}</div>)}</div></div>
    </section>

    <section id="technologie" className={styles.section+" "+styles.darkSection}>
      <div className={styles.sectionIntro}><span className={styles.kicker}>02 · SECURITY STACK</span><h2>Jedna architektura. <em>Wiele warstw ochrony.</em></h2><p>Od CCTV i SSWiN po kontrolę dostępu, PPOŻ, sieć i integrację IT.</p></div>
      <div className={styles.stackGrid}>{stack.map(([num,title,text,Icon])=><article key={num}><span>{num}</span><Icon size={20}/><h3>{title}</h3><p>{text}</p><ChevronRight size={16}/></article>)}</div>
    </section>

    <section className={styles.aiSection}>
      <div className={styles.aiVisual}><div className={styles.aiOrbit}/><div className={styles.aiCore}><Sparkles size={28}/><b>AI</b><small>SECURITY<br/>ARCHITECT</small></div>{["CCTV","KD","SSWiN","PPOŻ","LAN","IT"].map((x,i)=><span key={x} className={styles.aiNode} style={{["--n" as string]:i}}>{x}</span>)}</div>
      <div className={styles.aiCopy}><span className={styles.kicker}>03 · ALERT AI SECURITY ARCHITECT</span><h2>Opisz obiekt. <em>Engine buduje architekturę.</em></h2><p>Cyfrowy doradca ALERT porządkuje profil obiektu, istniejące systemy, ryzyka i priorytety, aby przygotować człowieka do właściwej decyzji technicznej.</p><div className={styles.aiSteps}>{["Profil obiektu","Mapa ryzyka","Security Stack","Plan modernizacji"].map((x,i)=><div key={x}><span>0{i+1}</span><b>{x}</b><ChevronRight size={14}/></div>)}</div><a className={styles.primary} href="#audyt">Uruchom koncepcję audytu <ArrowRight size={16}/></a></div>
    </section>

    <section id="audyt" className={styles.auditSection}>
      <div className={styles.auditCopy}><span className={styles.kicker}>04 · SECURITY AUDIT ENGINE</span><h2>Audyt, który zamienia <em>problem w plan.</em></h2><p>Wybierz typ obiektu, skalę i obecne systemy. ALERT tworzy wstępny profil zakresu modernizacji. To demonstracja UX, a nie wycena ani certyfikowana ocena ryzyka.</p><div className={styles.auditPills}><span>Profil obiektu</span><span>Luki technologiczne</span><span>Modernizacja</span><span>Priorytety</span></div></div>
      <div className={styles.auditCard}><div className={styles.auditHeader}><span>OBJECT INTAKE / 04</span><b>READY</b></div>
        <label>Typ obiektu<select value={surface} onChange={e=>setSurface(e.target.value)}><option>Hala produkcyjna</option><option>Magazyn</option><option>Biurowiec</option><option>Hotel</option><option>Obiekt publiczny</option></select></label>
        <label>Powierzchnia (m²)<input value={area} onChange={e=>setArea(e.target.value)} inputMode="numeric"/></label>
        <div className={styles.checkGrid}>{["CCTV","SSWiN","KD","RCP","PPOŻ","LAN"].map(x=><button key={x} className={systems.includes(x)?styles.checked:""} onClick={()=>toggleSystem(x)}><Check size={13}/>{x}</button>)}</div>
        <button className={styles.auditButton} onClick={createMission}><FileSearch size={16}/>UTWÓRZ PROFIL AUDYTU<ArrowRight size={15}/></button>
      </div>
    </section>

    <section id="misje" className={styles.commandSection}>
      <div className={styles.sectionIntro}><span className={styles.kicker}>05 · ALERT MISSION CONTROL</span><h2>Każdy audyt kończy się <em>następnym krokiem.</em></h2><p>Warstwa cyfrowa może przekuć dane obiektu w misję: co sprawdzić, co zmodernizować, co wdrożyć i jak mierzyć rezultat.</p></div>
      <div className={styles.commandGrid}>
        <article className={styles.tone_violet}><span>MISSION 001</span><strong>01</strong><small>Profil obiektu</small><div className={styles.miniBars}><i/><i/><i/><i/><i/></div></article>
        <article className={styles.tone_orange}><span>MISSION 002</span><strong>02</strong><small>Mapa luk technologicznych</small><div className={styles.miniBars}><i/><i/><i/><i/><i/></div></article>
        <article className={styles.tone_green}><span>MISSION 003</span><strong>03</strong><small>Plan modernizacji</small><div className={styles.miniBars}><i/><i/><i/><i/><i/></div></article>
        <article className={styles.tone_red}><span>MISSION 004</span><strong>04</strong><small>Serwis · SLA · ciągłość</small><div className={styles.miniBars}><i/><i/><i/><i/><i/></div></article>
      </div>
      {auditOpen && <div className={styles.missionResult}><div><Target size={18}/><span>MISSION GENERATED</span><b>{surface} · {area} m²</b></div><div><Activity size={18}/><span>OBSERVATION</span><b>{systems.join(" · ") || "Zakres do ustalenia"}</b></div><div><Zap size={18}/><span>NEXT ACTION</span><b>Audyt techniczny → architektura → plan modernizacji</b></div></div>}
    </section>

    <section id="realizacje" className={styles.section}><div className={styles.sectionIntro}><span className={styles.kicker}>06 · REALIZACJE / KOMPETENCJE</span><h2>Doświadczenie, które pracuje <em>na kolejne projekty.</em></h2><p>ALERT ma historię realizacji i kompetencje w środowiskach przemysłowych, komercyjnych i publicznych. Referencje powinny być prezentowane na stronie wyłącznie w zakresie potwierdzonym przez firmę.</p></div><div className={styles.caseGrid}>{[["PRZEMYSŁ","Hale i produkcja","CCTV · SSWiN · KD · LAN"],["HANDEL","Obiekty wielkopowierzchniowe","CCTV · analityka · kontrola"],["PUBLIC","Instytucje i administracja","SSP · CCTV · KD · sieci"],["MODERNIZACJA","Istniejące instalacje","audyt · etapowanie · serwis"]].map(([tag,title,desc])=><article key={tag}><span>{tag}</span><h3>{title}</h3><p>{desc}</p><a href="#kontakt">Zobacz model realizacji <ArrowRight size={14}/></a></article>)}</div></section>

    <section id="strategia" className={styles.section+" "+styles.strategy}><div className={styles.sectionIntro}><span className={styles.kicker}>07 · PERSPEKTYWA ROZWOJU</span><h2>Od wykonawcy do <em>partnera technologicznego.</em></h2><p>Strategiczna warstwa strony pokazuje zarządowi i klientowi kierunek: integracja, modernizacja, serwis lifecycle, specjalizacja verticalowa i cyfrowa kwalifikacja leadów.</p></div><div className={styles.strategyGrid}>{[["01","POSITIONING","Security Engineering","Projektować rozwiązania zamiast komunikować wyłącznie katalog usług."],["02","VERTICALS","Przemysł · magazyny · handel · public","Budować osobne ścieżki zakupowe, treści i referencje."],["03","RECURRING","Serwis + SLA + modernizacja","Rozwijać relację z klientem po uruchomieniu systemu."],["04","AI","Audit + Architect + Missions","AI ma przyspieszać analizę i sprzedaż, nie zastępować inżyniera."],["05","PARTNERS","Ekosystem technologiczny","Dobierać producentów do problemu, architektury i wymagań."],["06","EXPANSION","Górny Śląsk → Polska","Skalować przez specjalizację branżową i partnerstwa."]].map(([n,t,h,p])=><article key={n}><span>{n} · {t}</span><h3>{h}</h3><p>{p}</p></article>)}</div></section>

    <section className={styles.lifecycle}><div className={styles.sectionIntro}><span className={styles.kicker}>08 · SECURITY LIFECYCLE</span><h2>Klient powinien zostać z ALERT <em>po instalacji.</em></h2></div><div className={styles.lifecycleRail}>{lifecycle.map((x,i)=><div key={x}><span>0{i+1}</span><b>{x}</b>{i<lifecycle.length-1&&<ArrowRight size={14}/>}</div>)}</div></section>

    <section className={styles.future}><div className={styles.futureCard}><span className={styles.kicker}>THE NEW ALERT</span><h2>Security technology partner. <em>Od projektu do ciągłości.</em></h2><p>Historia, kompetencje techniczne, szeroki stack, serwis i lokalna obecność tworzą fundament pod nowoczesną komunikację ALERT. Cyfrowe audyty i misje są warstwą wspierającą sprzedaż i obsługę.</p><div className={styles.futureGrid}><span>ENGINEERING</span><span>INTEGRATION</span><span>AI</span><span>SERVICE</span><span>MODERNIZATION</span><span>DATA</span></div></div></section>

    <section id="kontakt" className={styles.contact}><div><span className={styles.kicker}>09 · KONTAKT</span><h2>Masz obiekt. <em>ALERT buduje plan.</em></h2><p>Myśliwska 69 · 41-800 Zabrze. Rozmowa o obiekcie, istniejącej infrastrukturze i potrzebach bezpieczeństwa.</p></div><div className={styles.contactActions}><a className={styles.primary} href="tel:+48322761320">Porozmawiaj z ALERT <ArrowRight size={16}/></a><a className={styles.secondary} href="mailto:alert@alert.net.pl">alert@alert.net.pl <ArrowRight size={16}/></a></div></section>
    <footer className={styles.footer}><div className={styles.brand}><span className={styles.logoMark}><span/><span/><span/></span><span><b>ALERT</b><small>SECURITY ENGINEERING</small></span></div><span>Myśliwska 69 · 41-800 Zabrze · od 1990</span><span>Technical Security · Teletechnika · IT</span></footer>
  </main>;
}