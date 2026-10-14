import { NextResponse } from "next/server"
import { requirePermission, assertStepUp } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { issueInvitation } from "@/lib/auth/invitation"
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"
import { emailEnabled, sendInvitation } from "@/lib/email"
import { deniesLocalSignIn } from "@/lib/sso/policy"
import { appBaseUrl } from "@/lib/appUrl"

type Params = { params: Promise<{ id: string }> }

// A single-use link, so nobody but the invitee ever learns the password, unlike a temporary one.
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

  // Refused when the sign-in policy forbids passwords, since the token would grant nothing yet be worth stealing.
  if (deniesLocalSignIn(target.company, target)) {
    return NextResponse.json(
      { error: "This company requires signing in through its identity provider" },
      { status: 409 }
    )
  }

  // Step-up required, as for an admin role, since an invitation ends in working credentials.
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

  const link = `${appBaseUrl()}/invite?token=${encodeURIComponent(token)}`

  if (emailEnabled()) {
    if (await sendInvitation(target.email, link, expiresAt)) {
      return NextResponse.json({ ok: true, delivered: "email", expiresAt })
    }
    // Undelivered, so the link is retired rather than left live in a log.
    await prisma.userInvitation.updateMany({
      where: { userId: target.id, consumedAt: null },
      data: { consumedAt: new Date() },
    })
    return NextResponse.json({ error: "Could not send the invitation email" }, { status: 502 })
  }

  // Without a mail provider the link goes back to the admin, which production refuses.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Email delivery is not configured on this deployment" },
      { status: 503 }
    )
  }
  return NextResponse.json({ ok: true, delivered: "link", link, expiresAt })
}
