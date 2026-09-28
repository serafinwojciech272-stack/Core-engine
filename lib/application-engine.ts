import { candidateProfile } from "@/lib/candidate-profile";

export type ApplicationInput = {
  title: string;
  company?: string | null;
  location?: string | null;
  description?: string | null;
  url: string;
  matchScore?: number | null;
  decision?: string | null;
};

const roleFamilies: Record<string,string[]> = {
  business_development:["business development","business development manager","sales manager","commercial manager"],
  operations:["operations manager","business operations","operations","process manager"],
  customer:["customer service","customer experience","customer success","order management"],
  account:["account manager","key account","key account manager"],
  leadership:["team leader","supervisor","manager","kierownik","koordynator"],
  export:["export manager","export","german speaking"]
};

function haystack(job: ApplicationInput) {
  return [job.title, job.company, job.location, job.description].filter(Boolean).join(" ").toLowerCase();
}

export function prepareApplication(job: ApplicationInput) {
  const text = haystack(job);
  const matchedFamilies = Object.entries(roleFamilies)
    .filter(([, terms]) => terms.some(term => text.includes(term)))
    .map(([family]) => family);

  const evidence = {
    german: /german|deutsch|niemiecki/.test(text),
    english: /english|angielski/.test(text),
    management: /manager|lead|supervisor|kierownik|koordynator|senior/.test(text),
    local: /gliwice|zabrze|bytom|ruda śląska|knurów|tarnowskie góry|pyskowice|chorzów/.test(text),
    remote: /remote|zdalna|hybryd/.test(text),
    drivingRisk: /prawo jazdy|driving licence|driving license|własny samochód|praca mobilna/.test(text)
  };

  const risks: string[] = [];
  if (evidence.drivingRisk) risks.push("Oferta może wymagać prawa jazdy lub mobilności — wymaga ręcznej weryfikacji.");
  if (!evidence.german && matchedFamilies.some(x => ["customer","export"].includes(x))) risks.push("Brak potwierdzonego wymagania języka niemieckiego w treści oferty.");
  if (!evidence.local && !evidence.remote) risks.push("Lokalizacja oferty wymaga ręcznej weryfikacji.");

  const tailoredHeadline = matchedFamilies.includes("leadership")
    ? "Manager | Operations | Customer Experience | Business Development"
    : matchedFamilies.includes("customer")
      ? "Customer Service | Customer Experience | Operations | German / English"
      : matchedFamilies.includes("business_development")
        ? "Business Development | Sales | Account Management | German / English"
        : candidateProfile.headline;

  const tailoredSummary = `Manager z doświadczeniem w zarządzaniu, sprzedaży, customer service, operacjach i budowaniu relacji z klientami. Doświadczenie właścicielskie i korporacyjne, język niemiecki ${candidateProfile.languages[0].level} oraz angielski ${candidateProfile.languages[1].level}. Profil dopasowany do stanowiska: ${job.title} w ${job.company || "organizacji"}.`;

  const coverLetter = `Szanowni Państwo,

aplikuję na stanowisko ${job.title}${job.company ? ` w firmie ${job.company}` : ""}. Moje doświadczenie obejmuje zarządzanie działalnością, sprzedaż, customer service, koordynację procesów oraz rozwój relacji z klientami. Pracowałem zarówno jako manager i współwłaściciel firmy, jak i w środowisku korporacyjnym customer service.

Posługuję się językiem niemieckim na poziomie ${candidateProfile.languages[0].level} oraz angielskim na poziomie ${candidateProfile.languages[1].level}. Szczególnie dobrze odnajduję się w rolach wymagających odpowiedzialności za klienta, proces, wynik i współpracę między zespołami.

Chętnie przedstawię szczegóły mojego doświadczenia podczas rozmowy.

Z poważaniem,
${candidateProfile.name}`;

  return {
    mode: "REVIEW_BEFORE_SUBMIT",
    approvalRequired: true,
    job,
    match: {
      score: job.matchScore ?? null,
      decision: job.decision ?? "REVIEW",
      roleFamilies: matchedFamilies,
      evidence,
      risks
    },
    cv: {
      profile: candidateProfile,
      tailoredHeadline,
      tailoredSummary,
      selectedSections: ["PROFILE","EXPERIENCE","EDUCATION","LANGUAGES","TARGET_ROLES"]
    },
    coverLetter,
    submission: {
      providerUrl: job.url,
      automaticSubmission: false,
      requiredAction: "HUMAN_APPROVAL"
    }
  };
}
