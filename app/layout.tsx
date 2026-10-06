import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./ui-enhancement.css";

export const metadata: Metadata = {
  title: "Core Engine AI | Twój uniwersalny agent AI",
  description: "Core Engine AI rozumie zadania, analizuje dokumenty, buduje rozwiązania, prowadzi research i przygotowuje kontrolowane działania.",
  robots: { index: true, follow: true }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pl"><body>{children}</body></html>;
}