import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { requirePermission } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"
import { assertMayGrantRole } from "@/lib/rbac/grant-role"

// Bounded quantifiers (64, 255 and 63 per addressing rules) avoid polynomial ReDoS (CodeQL js/polynomial-redos).
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{1,63}$/

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

// Creates an SSO-only shell account with no password, token or secret; it signs in once SSO is verified.
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
    select: { id: true, name: true, permissions: true },
  })
  if (!role) return NextResponse.json({ error: "Unknown role" }, { status: 400 })

  // Same grant rule as role reassignment, since account creation is the other way to hand out a role.
  const grant = await assertMayGrantRole(session.user, role)
  if (grant) return grant

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
    // Race backstop for two requests with the same email; any other error surfaces as a 500.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "That email already has an account" }, { status: 409 })
    }
    throw e
  }
}
