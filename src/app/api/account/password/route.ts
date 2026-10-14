import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rateLimit"
import { verifyPassword } from "@/lib/rbac/step-up"
import { passwordProblem } from "@/lib/auth/invitation"

// Only under an admin-required rotation, enforced here; it skips requireAuth, which refuses exactly these users.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Bounds guessing of the current password, since this route sits outside Better Auth's rate limiting.
  if (!(await rateLimit(`password-change:${session.user.id}`, 5, 60_000))) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 })
  }

  if (session.user.mustChangePassword !== true) {
    return NextResponse.json({ error: "Ask an administrator to require a password change" }, { status: 403 })
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
    // Every other session dies with the old password, but the caller's survives.
    await tx.session.deleteMany({
      where: { userId: session.user.id, token: { not: currentSessionToken } },
    })
  })

  return NextResponse.json({ ok: true })
}
