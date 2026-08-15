import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rateLimit"
import { verifyPassword } from "@/lib/rbac/step-up"
import { passwordProblem } from "@/lib/auth/invitation"

// Setting a new password, and only as part of a rotation an administrator has
// required. Changing a password at will is not a self-service action in this
// product: a user who wants a new one asks an administrator, who requires the
// rotation, which is what unlocks this endpoint for them.
//
// That rule is enforced here rather than by leaving the form out of the
// interface. A control that exists only in the UI is not a control: the request
// this route answers can be made with any HTTP client.
//
// Deliberately not behind requireAuth either: that guard refuses every call
// from a user under a forced rotation, which is precisely who calls this. It
// authenticates on its own terms and re-checks the current password, so a
// stolen session cookie alone cannot lock the real owner out.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Bounds the guessing of the current password through this endpoint, which
  // sits outside Better Auth's own rate limiting.
  if (!(await rateLimit(`password-change:${session.user.id}`, 5, 60_000))) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 })
  }

  if (session.user.mustChangePassword !== true) {
    return NextResponse.json(
      { error: "Ask an administrator to require a password change" },
      { status: 403 }
    )
  }

  const body = (await req.json().catch(() => ({}))) as {
    currentPassword?: unknown
    newPassword?: unknown
  }
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : ""
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : ""

  const problem = passwordProblem(newPassword)
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })

  const credential = await prisma.account.findFirst({
    where: { userId: session.user.id, providerId: "credential" },
    select: { id: true },
  })
  if (!credential) {
    return NextResponse.json(
      { error: "This account signs in through the identity provider" },
      { status: 409 }
    )
  }

  if (!(await verifyPassword(prisma, session.user.id, currentPassword))) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 })
  }

  if (currentPassword === newPassword) {
    return NextResponse.json({ error: "Choose a different password" }, { status: 400 })
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12)
  const currentSessionToken = session.session.token

  await prisma.$transaction(async (tx) => {
    await tx.account.update({ where: { id: credential.id }, data: { password: hashedPassword } })
    await tx.user.update({
      where: { id: session.user.id },
      data: { mustChangePassword: false },
    })
    // Every other session dies with the old password. The one making this call
    // survives, so the user is not thrown back to the login screen for doing
    // the right thing.
    await tx.session.deleteMany({
      where: { userId: session.user.id, token: { not: currentSessionToken } },
    })
  })

  return NextResponse.json({ ok: true })
}
