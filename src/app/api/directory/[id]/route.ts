import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin()
  if (error) return error

  const { id } = await params

  const connection = await prisma.directoryConnection.findFirst({
    where: { id, companyId: session.user.companyId },
  })
  if (!connection) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.directoryConnection.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
