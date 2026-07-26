import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

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
