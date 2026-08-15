import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requirePermission("api_credentials:manage")
  if (error) return error

  const { id } = await params

  const credential = await prisma.apiCredential.findFirst({
    where: { id, companyId: session.user.companyId },
  })
  if (!credential) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.apiCredential.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
