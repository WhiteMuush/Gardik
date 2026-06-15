import { NextResponse } from "next/server"
import type { Session } from "next-auth"
import { auth } from "@/auth"

// Single source of truth for API route authorization.
// Role model: ADMIN configures the workspace (API keys, directory
// connections, webhooks); VIEWER operates (reads data, runs scans,
// triages alerts). Callers do `const { session, error } = await requireX()`
// and return `error` when present.
type Guard = { session: Session; error: null } | { session: null; error: NextResponse }

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 })
const forbidden = () => NextResponse.json({ error: "Admin only" }, { status: 403 })

export async function requireAuth(): Promise<Guard> {
  const session = await auth()
  if (!session) return { session: null, error: unauthorized() }
  return { session, error: null }
}

export async function requireAdmin(): Promise<Guard> {
  const session = await auth()
  if (!session) return { session: null, error: unauthorized() }
  if (session.user.role !== "ADMIN") return { session: null, error: forbidden() }
  return { session, error: null }
}
