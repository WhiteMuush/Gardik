import type { Metadata } from "next"
import "./globals.css"

// Prerendered pages cannot carry the per-request CSP nonce, so rendering is dynamic everywhere.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Gardik",
  description: "Self-hosted employee data breach monitoring",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="font-sans">
      <body>{children}</body>
    </html>
  )
}
