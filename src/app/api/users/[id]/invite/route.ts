import { NextResponse } from "next/server"
import { requirePermission, assertStepUp } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { issueInvitation } from "@/lib/auth/invitation"
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"
import { emailEnabled, sendInvitation } from "@/lib/email"
import { deniesLocalSignIn } from "@/lib/sso/policy"

type Params = { params: Promise<{ id: string }> }

const APP_URL = process.env.AUTH_URL ?? "http://localhost:3000"

// Issues a single-use link that lets somebody set their own first password.
// Deliberately not "generate a temporary password and show it to the admin":
// that hands a working credential to a second person, leaves it sitting in
// whatever channel carried it, and makes every later action by that account
// deniable. Nobody but the invitee ever learns the password chosen here.
export async function POST(_req: Request, { params }: Params) {
  const { session, error } = await requirePermission("users:manage")
  if (error) return error
  const { id } = await params

  const target = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      companyId: true,
      ssoExempt: true,
      company: { select: { ssoMandatory: true } },
    },
  })
  if (!target || target.companyId !== session.user.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Handing out a password path the sign-in policy then refuses would produce
  // an account that cannot be used and a live token that grants nothing but
  // still deserves to be stolen. Refuse up front instead.
  if (deniesLocalSignIn(target.company, target)) {
    return NextResponse.json(
      { error: "This company requires signing in through its identity provider" },
      { status: 409 }
    )
  }

  // Same bar as assigning an administrator role: an invitation ends in working
  // credentials for an account, so a hijacked admin session should not be
  // enough on its own.
  const gate = await assertStepUp(session.user.id)
  if (gate) return gate

  const { token, expiresAt } = await prisma.$transaction(async (tx) => {
    const issued = await issueInvitation(tx, {
      userId: target.id,
      createdByUserId: session.user.id,
    })
    await writeAudit(tx, {
      companyId: session.user.companyId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.USER_INVITE,
      targetType: "User",
      targetId: target.id,
      after: { email: target.email, expiresAt: issued.expiresAt },
    })
    return issued
  })

  const link = `${APP_URL}/invite?token=${encodeURIComponent(token)}`

  if (emailEnabled()) {
    if (await sendInvitation(target.email, link, expiresAt)) {
      return NextResponse.json({ ok: true, delivered: "email", expiresAt })
    }
    // The link exists but reached nobody. Retire it rather than leave a live
    // token whose only copy is in a log somewhere.
    await prisma.userInvitation.updateMany({
      where: { userId: target.id, consumedAt: null },
      data: { consumedAt: new Date() },
    })
    return NextResponse.json({ error: "Could not send the invitation email" }, { status: 502 })
  }

  // No mail provider configured. Returning the link to the caller is a weaker
  // arrangement (the administrator sees a credential-bearing URL), so it is
  // confined to non-production: a deployment must configure email.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Email delivery is not configured on this deployment" },
      { status: 503 }
    )
  }
  return NextResponse.json({ ok: true, delivered: "link", link, expiresAt })
}
