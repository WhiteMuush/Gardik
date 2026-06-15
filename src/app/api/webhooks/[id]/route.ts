import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Severity } from "@prisma/client"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Admin only" }, { status: 403 })

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
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Admin only" }, { status: 403 })

  const { id } = await params
  const { count } = await prisma.webhook.deleteMany({
    where: { id, companyId: session.user.companyId },
  })
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
