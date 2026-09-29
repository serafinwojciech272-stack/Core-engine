export const candidateProfile = {
  name: "Wojciech Serafin",
  headline: "Business Development / Operations / Customer Experience Manager",
  location: "Gliwice, Poland",
  languages: [
    { name: "German", level: "B2+" },
    { name: "English", level: "B2/C1" },
    { name: "Polish", level: "native" }
  ],
  constraints: {
    drivingLicense: false,
    preferredArea: "Gliwice / Zabrze + 30 km",
    applicationMode: "REVIEW_BEFORE_SUBMIT"
  },
  targetRoles: [
    "Business Development Manager",
    "Operations Manager",
    "Customer Experience Manager",
    "Customer Service Manager",
    "Sales Manager",
    "Account Manager",
    "Key Account Manager",
    "Business Operations Manager",
    "Process Manager",
    "Commercial Manager",
    "Team Leader / Supervisor",
    "Export Manager",
    "German Speaking Manager"
  ],
  experience: [
    {
      company: "Mini Browar Majer, Gliwice",
      period: "06.2026 – obecnie",
      role: "Obsługa klienta / sala / bar",
      bullets: ["Obsługa à la carte", "Imprezy okolicznościowe", "Obsługa baru"]
    },
    {
      company: "Restauracja Polska, Gliwice",
      period: "2026",
      role: "Obsługa klienta / sala / bar / kuchnia",
      bullets: ["Obsługa sali i baru", "Organizacja pracy podczas śniadań i business lunchu", "Wsparcie komunikacji i promocji lokalu"]
    },
    {
      company: "Web-Profit",
      period: "2008 – 2020",
      role: "Współwłaściciel / Manager",
      bullets: ["Zarządzanie działalnością i sprzedażą", "Szkolenia produktowe i sprzedażowe", "Nadzór nad stronami internetowymi", "Google Ads i później SEO", "Obsługa i rozwój relacji z klientami"]
    },
    {
      company: "Honeywell",
      period: "doświadczenie korporacyjne",
      role: "Customer Service Specialist → Senior Customer Service Specialist",
      bullets: ["Obsługa klienta", "Koordynacja procesów zamówień", "Rozwój kompetencji customer service w środowisku międzynarodowym"]
    }
  ],
  education: [
    {
      school: "GWSH Katowice",
      period: "2000 – 2005",
      qualification: "Magister — Turystyka Międzynarodowa i Hotelarstwo"
    }
  ],
  certifications: ["Zaświadczenie Sanepid"],
  strengths: [
    "zarządzanie i operacje",
    "customer service / customer experience",
    "sprzedaż i rozwój biznesu",
    "praca z klientem B2B/B2C",
    "procesy i koordynacja",
    "język niemiecki i angielski"
  ]
} as const;
