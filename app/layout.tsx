import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata={title:"Core Engine | AI Decision & Execution Engine",description:"Universal AI intelligence layer for business growth."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}