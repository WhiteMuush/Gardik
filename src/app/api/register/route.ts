import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { listRegister } from "@/lib/register"
import { mapToGdprCategories } from "@/lib/gdpr"

export async function GET() {
  const { session, error } = await requirePermission("register:read")
  if (error) return error
  return NextResponse.json(await listRegister(session.user.companyId))
}

export async function POST(req: Request) {
  const { session, error } = await requirePermission("register:manage")
  if (error) return error

  const body = (await req.json()) as {
    title?: string
    detectedAt?: string
    affectedCount?: number
    dataTypes?: string[]
  }

  if (!body.title?.trim()) return NextResponse.json({ error: "Missing title" }, { status: 400 })

  const detectedAt = body.detectedAt ? new Date(body.detectedAt) : new Date()
  if (Number.isNaN(detectedAt.getTime()))
    return NextResponse.json({ error: "Invalid detectedAt" }, { status: 400 })

  await prisma.exposureRegisterEntry.create({
    data: {
      companyId: session.user.companyId,
      title: body.title.trim(),
      detectedAt,
      affectedCount: Math.max(0, Math.floor(body.affectedCount ?? 0)),
      dataCategories: mapToGdprCategories(body.dataTypes ?? []),
    },
  })

  return NextResponse.json(await listRegister(session.user.companyId), { status: 201 })
}
