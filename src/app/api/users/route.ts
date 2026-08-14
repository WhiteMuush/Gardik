import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { requirePermission } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET() {
  const { session, error } = await requirePermission("users:read")
  if (error) return error
  const users = await prisma.user.findMany({
    where: { companyId: session.user.companyId },
    select: { id: true, email: true, name: true, roleId: true, role: { select: { name: true } } },
    orderBy: { email: "asc" },
  })
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      roleId: u.roleId,
      roleName: u.role?.name ?? null,
    })),
  })
}

// Creates an SSO-only shell account: no password credential, no invitation
// token, no temporary secret to pass around. It can sign in only once the
// company has a verified SSO provider.
export async function POST(req: Request) {
  const { session, error } = await requirePermission("users:manage")
  if (error) return error

  const body = (await req.json()) as { email?: string; name?: string; roleId?: string }
  const email = body.email?.trim().toLowerCase()
  if (!email || !EMAIL.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 })
  }
  if (!body.roleId) return NextResponse.json({ error: "A role is required" }, { status: 400 })

  const role = await prisma.role.findFirst({
    where: { id: body.roleId, companyId: session.user.companyId, isAssignable: true },
    select: { id: true, name: true },
  })
  if (!role) return NextResponse.json({ error: "Unknown role" }, { status: 400 })

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return NextResponse.json({ error: "That email already has an account" }, { status: 409 })
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: body.name?.trim() || email,
          companyId: session.user.companyId,
          roleId: role.id,
          emailVerified: false,
        },
        select: { id: true, email: true, name: true },
      })
      await writeAudit(tx, {
        companyId: session.user.companyId,
        actorUserId: session.user.id,
        action: AUDIT_ACTIONS.USER_CREATE,
        targetType: "user",
        targetId: user.id,
        after: { email: user.email, name: user.name, role: role.name },
      })
      return user
    })
    return NextResponse.json({ user: { ...created, roleName: role.name } }, { status: 201 })
  } catch (e) {
    // The pre-check above handles the common case; this catch is the race
    // backstop when two concurrent requests both pass it for the same email.
    // Any other error (e.g. the audit write failing) should surface as a 500
    // rather than be mis-reported as a duplicate, and create+audit stay
    // atomic via the transaction above.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "That email already has an account" }, { status: 409 })
    }
    throw e
  }
}
