import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./ui-enhancement.css";

export const metadata: Metadata = {
  title: "Core Engine | Intelligence that moves business",
  description: "A governed intelligence core that turns business signals into measurable action.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Core Engine | Intelligence that moves business",
    description: "Observe, decide, execute and learn through one reusable intelligence core."
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
