"use client";

import Link from "next/link";
import { candidateProfile } from "@/lib/candidate-profile";

const contact = {
  phone: "510 763 171",
  email: "serafinwojciech272@gmail.com"
};

export default function CVPage() {
  return (
    <main className="cv-page">
      <div className="cv-shell">
        <header className="cv-toolbar">
          <Link href="/job-agent">← Job Agent</Link>
          <span>CV · Wojciech Serafin</span>
          <button type="button" onClick={() => window.print()}>DRUKUJ / PDF</button>
        </header>

        <article className="cv-sheet">
          <header className="cv-hero">
            <div className="cv-hero-main">
              <div className="cv-kicker">BUSINESS · OPERATIONS · CUSTOMER EXPERIENCE</div>
              <h1>{candidateProfile.name}</h1>
              <h2>{candidateProfile.headline}</h2>
              <p className="cv-location">{candidateProfile.location} · dostępność lokalnie / hybrydowo / zdalnie</p>
              <div className="cv-contact">
                <a href={`tel:+48510763171`}>+48 510 763 171</a>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </div>
            </div>
            <div className="cv-score-card">
              <span>PROFILE</span>
              <strong>B2+</strong>
              <small>German</small>
              <strong>B2/C1</strong>
              <small>English</small>
            </div>
          </header>

          <div className="cv-layout">
            <div className="cv-main">
              <section className="cv-section cv-summary">
                <div className="cv-section-label">01 / PROFIL</div>
                <h3>Manager łączący biznes, operacje i doświadczenie klienta.</h3>
                <p>Doświadczenie menedżerskie, sprzedażowe i customer service zdobywane zarówno w środowisku korporacyjnym, jak i we własnym biznesie. Praktyka w zarządzaniu, relacjach z klientami, procesach zamówień, sprzedaży, szkoleniach oraz rozwoju kanałów cyfrowych. Niemiecki B2+ i angielski B2/C1.</p>
              </section>

              <section className="cv-section">
                <div className="cv-section-label">02 / DOŚWIADCZENIE</div>
                {candidateProfile.experience.map((x) => (
                  <div className="cv-exp" key={x.company + x.period}>
                    <div className="cv-exp-head">
                      <div>
                        <b>{x.role}</b>
                        <strong>{x.company}</strong>
                      </div>
                      <span>{x.period}</span>
                    </div>
                    <ul>{x.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
                  </div>
                ))}
              </section>

              <section className="cv-section">
                <div className="cv-section-label">03 / EDUKACJA</div>
                {candidateProfile.education.map((x) => (
                  <div className="cv-education" key={x.school}>
                    <strong>{x.qualification}</strong>
                    <span>{x.school} · {x.period}</span>
                  </div>
                ))}
              </section>
            </div>

            <aside className="cv-side">
              <section className="cv-side-block">
                <div className="cv-section-label">KOMPETENCJE</div>
                <div className="cv-tags">
                  {candidateProfile.strengths.map((x) => <span key={x}>{x}</span>)}
                </div>
              </section>

              <section className="cv-side-block">
                <div className="cv-section-label">JĘZYKI</div>
                {candidateProfile.languages.map((x) => (
                  <div className="cv-language" key={x.name}>
                    <b>{x.name}</b><span>{x.level}</span>
                  </div>
                ))}
              </section>

              <section className="cv-side-block">
                <div className="cv-section-label">CEL ZAWODOWY</div>
                <p className="cv-note">Business Development · Operations · Customer Experience · Sales · Account Management · Process Management · Export</p>
              </section>

              <section className="cv-side-block cv-facts">
                <div><span>OBSZAR</span><b>Gliwice / Zabrze +30 km</b></div>
                <div><span>PRAWO JAZDY</span><b>Brak</b></div>
                <div><span>TRYB</span><b>Review before submit</b></div>
              </section>

              <section className="cv-side-block">
                <div className="cv-section-label">CERTYFIKAT</div>
                <p className="cv-note">{candidateProfile.certifications.join(" · ")}</p>
              </section>
            </aside>
          </div>

          <footer className="cv-footer">
            <span>WOJCIECH SERAFIN</span>
            <span>{contact.email} · +48 510 763 171</span>
          </footer>
        </article>
      </div>
    </main>
  );
}
