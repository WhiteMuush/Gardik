import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { AlertStatus } from "@prisma/client"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { id } = await params
  const body = await req.json()
  const status = body.status as AlertStatus

  if (!Object.values(AlertStatus).includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const { count } = await prisma.alert.updateMany({
    where: { id, companyId: session.user.companyId },
    data: { status },
  })

  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ id, status })
}
