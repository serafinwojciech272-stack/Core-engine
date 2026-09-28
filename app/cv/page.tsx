import Link from "next/link";
import { candidateProfile } from "@/lib/candidate-profile";

export default function CVPage() {
  return (
    <main className="cv-page">
      <header className="cv-toolbar">
        <Link href="/job-agent">← Job Agent</Link>
        <span>CV · Candidate Profile</span>
      </header>
      <article className="cv-sheet">
        <header className="cv-header">
          <div>
            <div className="cv-kicker">CORE ENGINE · CANDIDATE PROFILE</div>
            <h1>{candidateProfile.name}</h1>
            <h2>{candidateProfile.headline}</h2>
            <p>{candidateProfile.location} · German {candidateProfile.languages[0].level} · English {candidateProfile.languages[1].level}</p>
          </div>
          <div className="cv-badge">AI-READY<br /><span>REVIEW GATE</span></div>
        </header>
        <section className="cv-section">
          <h3>PROFIL</h3>
          <p>Manager z doświadczeniem w zarządzaniu, sprzedaży, customer service, operacjach i rozwoju relacji z klientami. Łączy doświadczenie właścicielskie i menedżerskie z pracą w międzynarodowym środowisku korporacyjnym. Niemiecki B2+ i angielski B2/C1.</p>
        </section>
        <section className="cv-section">
          <h3>DOŚWIADCZENIE</h3>
          {candidateProfile.experience.map((x) => (
            <div className="cv-exp" key={x.company + x.period}>
              <div><b>{x.role}</b><span>{x.period}</span></div>
              <strong>{x.company}</strong>
              <ul>{x.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
            </div>
          ))}
        </section>
        <div className="cv-columns">
          <section className="cv-section">
            <h3>EDUKACJA</h3>
            {candidateProfile.education.map((x) => <div key={x.school}><b>{x.qualification}</b><p>{x.school} · {x.period}</p></div>)}
          </section>
          <section className="cv-section">
            <h3>JĘZYKI</h3>
            {candidateProfile.languages.map((x) => <p key={x.name}><b>{x.name}</b> — {x.level}</p>)}
            <h3>ATUTY</h3>
            <p>{candidateProfile.strengths.join(" · ")}</p>
          </section>
        </div>
        <section className="cv-section cv-target">
          <h3>DOCELOWE STANOWISKA</h3>
          <p>{candidateProfile.targetRoles.join(" · ")}</p>
          <small>Preferowany obszar: {candidateProfile.constraints.preferredArea}. Prawo jazdy: brak.</small>
        </section>
      </article>
    </main>
  );
}
