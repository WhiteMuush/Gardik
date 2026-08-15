import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { RegisterStatus } from "@prisma/client"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requirePermission("register:manage")
  if (error) return error

  const { id } = await params
  const body = (await req.json()) as { status?: string; assessment?: string }

  const data: { status?: RegisterStatus; assessment?: string; notifiedAt?: Date } = {}
  if (body.status) {
    if (!(body.status in RegisterStatus))
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    data.status = body.status as RegisterStatus
    // Stamp the notification time the moment an entry is marked notified.
    if (body.status === "NOTIFIED") data.notifiedAt = new Date()
  }
  if (typeof body.assessment === "string") data.assessment = body.assessment

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })

  const { count } = await prisma.exposureRegisterEntry.updateMany({
    where: { id, companyId: session.user.companyId },
    data,
  })
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
