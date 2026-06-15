import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { AlertStatus } from "@prisma/client"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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
