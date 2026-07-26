import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const { session, error } = await requirePermission("audit:read")
  if (error) return error

  const url = new URL(req.url)
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 50) || 50, 1), 100)
  const skip = Math.max(Number(url.searchParams.get("skip") ?? 0) || 0, 0)

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: { actor: { select: { email: true } } },
    }),
    prisma.auditLog.count({ where: { companyId: session.user.companyId } }),
  ])
  return NextResponse.json({ entries, total })
}
