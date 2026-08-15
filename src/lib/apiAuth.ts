import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rateLimit"
import { getUserPermissions, authorize } from "@/lib/rbac/authorize"
import type { Permission } from "@/lib/rbac/permissions"
import { hasValidStepUp } from "@/lib/rbac/step-up"

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

// Distinct code so the client can route the user to the password form instead
// of showing a dead end, the same way STEP_UP_REQUIRED works.
const passwordChangeRequired = () =>
  NextResponse.json(
    { error: "Password change required", code: "PASSWORD_CHANGE_REQUIRED" },
    { status: 403 }
  )

// A ceiling on how fast one account can call the API at all, applied in the
// guard every authenticated route already goes through rather than route by
// route, where the next route added would be the one nobody remembers.
//
// Sized for a dashboard: a page load makes a handful of calls, so a person
// never approaches this, while a script hammering an endpoint does within
// seconds. Endpoints that deserve a stricter ceiling (signing in, redeeming an
// invitation, changing a password, proving identity again, scanning) keep their
// own tighter limit on top of this one.
//
// The cost is one indexed upsert per API call. That is the price of the ceiling
// existing at all rather than living in the routes somebody remembers to guard.
export const API_RATE_LIMIT = 120
export const API_RATE_WINDOW_MS = 60_000

const tooManyRequests = () =>
  NextResponse.json({ error: "Too many requests" }, { status: 429 })

function enforceApiRate(userId: string): Promise<NextResponse | null> {
  return rateLimit(`api:${userId}`, API_RATE_LIMIT, API_RATE_WINDOW_MS).then((ok) =>
    ok ? null : tooManyRequests()
  )
}

// A forced rotation has to hold at the API, not only in the layout redirect.
// Otherwise the user simply keeps calling the endpoints the pages would have
// used, and the requirement becomes a suggestion aimed at browsers.
//
// Read from the session rather than the database: the flag is only ever set
// together with deleting that user's sessions, so a session carrying
// mustChangePassword: false was necessarily issued after the flag was cleared.
// The password endpoints themselves live under /api/auth and never pass through
// this guard, which is what leaves the user a way out.
function enforcePasswordRotation(session: AuthResult): NextResponse | null {
  return session.user.mustChangePassword ? passwordChangeRequired() : null
}

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

// Distinct 403 shape so the client can tell "you lack the permission" (plain
// Forbidden) from "re-enter your password" (STEP_UP_REQUIRED) and open the
// step-up dialog instead of showing a dead end.
export const stepUpRequired = () =>
  NextResponse.json({ error: "Step-up required", code: "STEP_UP_REQUIRED" }, { status: 403 })

// Call AFTER requirePermission, only on crown-jewel mutations. Returns an error
// response when the caller has no fresh step-up grant, else null to proceed.
export async function assertStepUp(userId: string): Promise<NextResponse | null> {
  return (await hasValidStepUp(prisma, userId)) ? null : stepUpRequired()
}
