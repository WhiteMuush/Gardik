import type { Metadata } from "next"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { loadPreferences } from "@/lib/preferences/load"
import { preferenceAttributes } from "@/lib/preferences/apply"
import { DEFAULT_PREFERENCES } from "@/lib/preferences/schema"
import "./globals.css"

// Prerendered pages cannot carry the per-request CSP nonce, so rendering is dynamic everywhere.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Gardik",
  description: "Self-hosted employee data breach monitoring",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  const prefs = session ? await loadPreferences(prisma, session.user.id) : DEFAULT_PREFERENCES

  return (
    <html lang="en" className="font-sans" {...preferenceAttributes(prefs)}>
      <body>{children}</body>
    </html>
  )
}
