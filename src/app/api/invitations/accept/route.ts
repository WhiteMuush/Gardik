import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rateLimit"
import { consumeInvitation, hashToken } from "@/lib/auth/invitation"
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"

// Unauthenticated by necessity: the invitee has no account to sign in with yet.
// The token is the only thing that authorises this call, so everything else is
// treated as hostile input.
//
// Failure is deliberately uniform. Unknown token, spent token and expired token
// all return the same message and the same status, so the endpoint cannot be
// used to learn which tokens ever existed or when they were used.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { token?: unknown; password?: unknown }
  const token = typeof body.token === "string" ? body.token : ""
  const password = typeof body.password === "string" ? body.password : ""

  // Keyed on the token rather than the caller's address: an address is trivially
  // rotated, and what needs protecting is guessing attempts against a specific
  // link. 32 bytes of entropy already makes brute force hopeless; this keeps the
  // database out of a pointless hot loop.
  if (!(await rateLimit(`invite-accept:${hashToken(token)}`, 10, 60_000))) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 })
  }

  const result = await consumeInvitation(prisma, { token, password })
  // One status for every failure, including a weak password: the rule text is
  // the caller's own business and tells an attacker nothing, while a distinct
  // status per reason would separate "your password is short" (token was valid)
  // from "link is dead" and turn this into a token oracle.
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id: result.userId },
    select: { companyId: true },
  })
  if (user) {
    await writeAudit(prisma, {
      companyId: user.companyId,
      actorUserId: result.userId,
      action: AUDIT_ACTIONS.USER_INVITE_ACCEPT,
      targetType: "User",
      targetId: result.userId,
    })
  }

  // No session is issued here on purpose: the user signs in through the normal
  // path, which is what applies the company's 2FA and SSO policy to them.
  return NextResponse.json({ ok: true })
}
