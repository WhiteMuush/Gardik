import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 })

  const { id } = await params

  const preset = await prisma.dashboardPreset.findUnique({ where: { id } })
  if (!preset) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (preset.companyId !== session.user.companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await prisma.user.update({
    where: { id: session.user.id },
    data: { activePresetId: id },
  })

  return NextResponse.json({ ok: true })
}
