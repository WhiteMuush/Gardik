import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rateLimit"
import { getUserPermissions, authorize } from "@/lib/rbac/authorize"
import type { Permission } from "@/lib/rbac/permissions"
import { hasValidStepUp } from "@/lib/rbac/step-up"

// The only API authorization module: requirePermission checks a role grant, requireAuth only a valid session.
type AuthResult = NonNullable<Awaited<ReturnType<typeof getSession>>>
type Guard = { session: AuthResult; error: null } | { session: null; error: NextResponse }

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 })
const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 })
const twoFactorRequired = () =>
  NextResponse.json({ error: "Two-factor enrollment required" }, { status: 403 })

// A distinct code, like STEP_UP_REQUIRED, so the client routes to the password form instead of a dead end.
const passwordChangeRequired = () =>
  NextResponse.json({ error: "Password change required", code: "PASSWORD_CHANGE_REQUIRED" }, { status: 403 })

// Per-account API ceiling in the shared guard, sized so a person never reaches it but a script does.
export const API_RATE_LIMIT = 120
export const API_RATE_WINDOW_MS = 60_000

const tooManyRequests = () => NextResponse.json({ error: "Too many requests" }, { status: 429 })

function enforceApiRate(userId: string): Promise<NextResponse | null> {
  return rateLimit(`api:${userId}`, API_RATE_LIMIT, API_RATE_WINDOW_MS).then((ok) =>
    ok ? null : tooManyRequests()
  )
}

// Enforced at the API and read from the session, since setting the flag deletes the user's sessions.
function enforcePasswordRotation(session: AuthResult): NextResponse | null {
  return session.user.mustChangePassword ? passwordChangeRequired() : null
}

// Mirrors the layout's 2FA mandate at the API; /api/auth stays outside so a forced user can still enroll.
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
  const flood = await enforceApiRate(session.user.id)
  if (flood) return { session: null, error: flood }
  const rotation = enforcePasswordRotation(session)
  if (rotation) return { session: null, error: rotation }
  const gate = await enforce2fa(session)
  if (gate) return { session: null, error: gate }
  return { session, error: null }
}

export async function requirePermission(perm: Permission): Promise<Guard> {
  const session = await getSession()
  if (!session) return { session: null, error: unauthorized() }
  const flood = await enforceApiRate(session.user.id)
  if (flood) return { session: null, error: flood }
  const rotation = enforcePasswordRotation(session)
  if (rotation) return { session: null, error: rotation }
  const perms = await getUserPermissions(prisma, session.user.roleId ?? null)
  if (!authorize(perms, perm)) return { session: null, error: forbidden() }
  const gate = await enforce2fa(session)
  if (gate) return { session: null, error: gate }
  return { session, error: null }
}

// A distinct 403 so the client opens the step-up dialog rather than a plain Forbidden dead end.
export const stepUpRequired = () =>
  NextResponse.json({ error: "Step-up required", code: "STEP_UP_REQUIRED" }, { status: 403 })

// Call after requirePermission on crown-jewel mutations; returns an error without a fresh step-up grant.
export async function assertStepUp(userId: string): Promise<NextResponse | null> {
  return (await hasValidStepUp(prisma, userId)) ? null : stepUpRequired()
}
