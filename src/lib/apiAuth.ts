import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { getUserPermissions, authorize } from "@/lib/rbac/authorize"
import type { Permission } from "@/lib/rbac/permissions"

// Single source of truth for API route authorization.
// Permission model: each route requires a specific Permission (see
// lib/rbac/permissions.ts). `requirePermission(permission)` resolves the
// caller's role permissions from the DB and checks the grant; `requireAuth`
// only requires a valid session, for routes any authenticated user may hit.
// Callers do `const { session, error } = await requireX()` and return
// `error` when present.
type AuthResult = NonNullable<Awaited<ReturnType<typeof getSession>>>
type Guard = { session: AuthResult; error: null } | { session: null; error: NextResponse }

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 })
const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 })
const twoFactorRequired = () =>
  NextResponse.json({ error: "Two-factor enrollment required" }, { status: 403 })

// A company can force 2FA. The dashboard layout redirects un-enrolled users to
// /setup, but that only guards pages, so mirror the policy here to keep the API
// behind the same gate. The enrollment endpoints live under /api/auth and are
// not routed through this guard, so a forced user can still enroll. Only enrolled
// users skip the extra query, so the common path stays a single round-trip.
async function enforce2fa(session: AuthResult): Promise<NextResponse | null> {
  if (session.user.twoFactorEnabled) return null
  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { require2fa: true },
  })
  return company?.require2fa ? twoFactorRequired() : null
}

export async function requireAuth(): Promise<Guard> {
  const session = await getSession()
  if (!session) return { session: null, error: unauthorized() }
  const gate = await enforce2fa(session)
  if (gate) return { session: null, error: gate }
  return { session, error: null }
}

export async function requirePermission(perm: Permission): Promise<Guard> {
  const session = await getSession()
  if (!session) return { session: null, error: unauthorized() }
  const perms = await getUserPermissions(prisma, session.user.roleId ?? null)
  if (!authorize(perms, perm)) return { session: null, error: forbidden() }
  const gate = await enforce2fa(session)
  if (gate) return { session: null, error: gate }
  return { session, error: null }
}
