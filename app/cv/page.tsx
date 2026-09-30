"use client";

import Link from "next/link";
import { ArrowLeft, Download, ExternalLink, Mail, MapPin, Phone, ShieldCheck, Sparkles } from "lucide-react";
import { candidateProfile } from "@/lib/candidate-profile";

const contact = { phone: "+48 510 763 171", email: "serafinwojciech272@gmail.com" };

export default function CVPage() {
  return (
    <main className="cv-page">
      <div className="cv-shell">
        <header className="cv-toolbar">
          <Link href="/job-agent"><ArrowLeft size={15}/> Job Agent</Link>
          <div className="cv-toolbar-center"><span className="cv-live-dot"/> CORE ENGINE · CANDIDATE PROFILE</div>
          <button type="button" onClick={() => window.print()}><Download size={15}/> DRUKUJ / PDF</button>
        </header>

        <article className="cv-sheet">
          <header className="cv-hero">
            <div className="cv-hero-grid">
              <div className="cv-photo-wrap">
                <div className="cv-photo-ring"><img src="/wojciech-serafin-photo.svg" alt="Wojciech Serafin" /></div>
                <span className="cv-photo-status"><span/> AVAILABLE</span>
              </div>
              <div className="cv-identity">
                <div className="cv-kicker">BUSINESS DEVELOPMENT · OPERATIONS · CUSTOMER EXPERIENCE</div>
                <h1>Wojciech Serafin</h1>
                <h2>{candidateProfile.headline}</h2>
                <p className="cv-location"><MapPin size={14}/>{candidateProfile.location} · lokalnie / hybrydowo / zdalnie</p>
                <div className="cv-contact">
                  <a href="tel:+48510763171"><Phone size={14}/>{contact.phone}</a>
                  <a href={"mailto:"+contact.email}><Mail size={14}/>{contact.email}</a>
                </div>
              </div>
              <aside className="cv-profile-panel">
                <span className="cv-panel-label">PROFILE SIGNAL</span>
                <strong>DE / EN</strong>
                <div className="cv-lang-row"><b>German</b><span>B2+</span></div>
                <div className="cv-lang-row"><b>English</b><span>B2/C1</span></div>
                <div className="cv-panel-line"/>
                <small>Gliwice / Zabrze + 30 km</small>
              </aside>
            </div>
            <div className="cv-value-strip">
              <span><ShieldCheck size={14}/> MANAGEMENT</span>
              <span><Sparkles size={14}/> COMMERCIAL</span>
              <span><ShieldCheck size={14}/> CUSTOMER EXPERIENCE</span>
              <span><Sparkles size={14}/> PROCESS & SALES</span>
            </div>
          </header>

          <div className="cv-command">
            <div><span>CAREER POSITIONING</span><b>Manager łączący biznes, operacje i doświadczenie klienta.</b></div>
            <div><span>LANGUAGES</span><b>DE B2+ · EN B2/C1 · PL native</b></div>
            <div><span>WORK MODEL</span><b>Local · Hybrid · Remote</b></div>
            <div><span>DRIVING LICENCE</span><b>Not required / none</b></div>
          </div>

          <div className="cv-layout">
            <div className="cv-main">
              <section className="cv-section cv-summary">
                <div className="cv-section-label">01 / PROFIL ZAWODOWY</div>
                <h3>Doświadczenie menedżerskie, sprzedażowe i customer service w jednym profilu.</h3>
                <p>Łączę doświadczenie z własnego biznesu, środowiska korporacyjnego i operacyjnej pracy z klientem. Mam praktykę w zarządzaniu działalnością i sprzedażą, relacjach B2B/B2C, procesach zamówień, szkoleniach, obsłudze klienta oraz rozwijaniu kanałów cyfrowych. Pracuję procesowo, komunikuję się po niemiecku i angielsku i potrafię przełożyć potrzeby klienta na konkretne działanie biznesowe.</p>
              </section>

              <section className="cv-section">
                <div className="cv-section-label">02 / DOŚWIADCZENIE</div>
                {candidateProfile.experience.map((x, i) => (
                  <div className="cv-exp" key={x.company + x.period}>
                    <div className="cv-exp-index">0{i + 1}</div>
                    <div className="cv-exp-body">
                      <div className="cv-exp-head">
                        <div><b>{x.role}</b><strong>{x.company}</strong></div>
                        <span>{x.period}</span>
                      </div>
                      <ul>{x.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
                    </div>
                  </div>
                ))}
              </section>

              <section className="cv-section">
                <div className="cv-section-label">03 / EDUKACJA</div>
                {candidateProfile.education.map((x) => (
                  <div className="cv-education" key={x.school}>
                    <div className="cv-edu-mark">EDU</div>
                    <div><strong>{x.qualification}</strong><span>{x.school} · {x.period}</span></div>
                  </div>
                ))}
              </section>
            </div>

            <aside className="cv-side">
              <section className="cv-side-block">
                <div className="cv-section-label">KOMPETENCJE</div>
                <div className="cv-tags">{candidateProfile.strengths.map((x) => <span key={x}>{x}</span>)}</div>
              </section>

              <section className="cv-side-block">
                <div className="cv-section-label">JĘZYKI</div>
                {candidateProfile.languages.map((x) => (
                  <div className="cv-language" key={x.name}><b>{x.name}</b><span>{x.level}</span></div>
                ))}
              </section>

              <section className="cv-side-block">
                <div className="cv-section-label">CEL ZAWODOWY</div>
                <div className="cv-targets">
                  {candidateProfile.targetRoles.slice(0, 8).map((x) => <span key={x}>{x}</span>)}
                </div>
              </section>

              <section className="cv-side-block cv-facts">
                <div><span>OBSZAR</span><b>Gliwice / Zabrze +30 km</b></div>
                <div><span>PRAWO JAZDY</span><b>Brak</b></div>
                <div><span>TRYB APLIKOWANIA</span><b>Review before submit</b></div>
              </section>

              <section className="cv-side-block">
                <div className="cv-section-label">CERTYFIKAT</div>
                <p className="cv-note">{candidateProfile.certifications.join(" · ")}</p>
              </section>

              <Link href="/job-agent" className="cv-back-cta"><ExternalLink size={14}/> WRÓĆ DO JOB AGENT</Link>
            </aside>
          </div>

          <footer className="cv-footer">
            <span>CORE ENGINE · WOJCIECH SERAFIN</span>
            <span>{contact.email} · {contact.phone}</span>
          </footer>
        </article>
      </div>
    </main>
  );
}