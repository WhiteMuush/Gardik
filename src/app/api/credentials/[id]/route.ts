import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { parseRateLimit } from "@/lib/credentials/service"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requirePermission("api_credentials:manage")
  if (error) return error

  const { id } = await params
  const body = (await req.json()) as { rateLimitPerMinute?: unknown }
  const rate = parseRateLimit(body.rateLimitPerMinute)
  if (!rate.ok) {
    return NextResponse.json(
      { error: "rateLimitPerMinute must be a whole number from 1 to 100000, or null" },
      { status: 400 }
    )
  }

  const credential = await prisma.apiCredential.findFirst({
    where: { id, companyId: session.user.companyId },
  })
  if (!credential) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updated = await prisma.apiCredential.update({
    where: { id },
    data: { rateLimitPerMinute: rate.value },
    select: { id: true, provider: true, keyHint: true, rateLimitPerMinute: true, lastUsedAt: true },
  })
  return NextResponse.json(updated)
}

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
