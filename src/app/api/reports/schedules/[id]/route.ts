import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requirePermission("reports:schedule")
  if (error) return error

  const { id } = await params
  const body = (await req.json()) as { enabled?: boolean }
  if (typeof body.enabled !== "boolean")
    return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 })

  const { count } = await prisma.reportSchedule.updateMany({
    where: { id, companyId: session.user.companyId },
    data: { enabled: body.enabled },
  })
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ id, enabled: body.enabled })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requirePermission("reports:schedule")
  if (error) return error

  const { id } = await params
  const { count } = await prisma.reportSchedule.deleteMany({
    where: { id, companyId: session.user.companyId },
  })
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
