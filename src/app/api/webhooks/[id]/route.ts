import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { Severity } from "@prisma/client"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const body = (await req.json()) as { enabled?: boolean; minSeverity?: string }

  const data: { enabled?: boolean; minSeverity?: Severity } = {}
  if (typeof body.enabled === "boolean") data.enabled = body.enabled
  if (body.minSeverity && body.minSeverity in Severity)
    data.minSeverity = body.minSeverity as Severity

  const { count } = await prisma.webhook.updateMany({
    where: { id, companyId: session.user.companyId },
    data,
  })
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ id, ...data })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const { count } = await prisma.webhook.deleteMany({
    where: { id, companyId: session.user.companyId },
  })
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
