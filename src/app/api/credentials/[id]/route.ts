import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Admin only" }, { status: 403 })

  const { id } = await params

  const credential = await prisma.apiCredential.findFirst({
    where: { id, companyId: session.user.companyId },
  })
  if (!credential) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.apiCredential.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
