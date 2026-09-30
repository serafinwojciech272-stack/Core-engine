import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Core Engine | Job Agent",
  description: "Core Engine job search and matching dashboard.",
  robots: { index: true, follow: true }
};

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
