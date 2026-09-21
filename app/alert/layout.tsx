import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ALERT | Security Engineering | Zabrze · Górny Śląsk",
  description: "Projektowanie, integracja i serwis systemów bezpieczeństwa, CCTV, SSWiN, kontroli dostępu, PPOŻ, sieci teletechnicznych i IT.",
  alternates: { canonical: "https://alert.net.pl/" },
  robots: { index: true, follow: true }
};

export default function AlertLayout({ children }: { children: React.ReactNode }) { return <>{children}</>; }
