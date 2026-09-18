import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Core Engine | AI Decision & Execution Infrastructure",
  description: "Universal AI decision and execution infrastructure for business growth.",
  viewport: "width=device-width, initial-scale=1",
  robots: { index: true, follow: true }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}