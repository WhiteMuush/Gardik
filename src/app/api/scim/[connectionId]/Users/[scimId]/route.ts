import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { decryptConfig } from "@/lib/directory/crypto"
import type { SCIMConfig } from "@/lib/directory/types"

type SCIMPatch = {
  Operations?: { op: string; path?: string; value?: unknown }[]
}

async function authenticate(
  req: Request,
  connectionId: string
): Promise<{ companyId: string } | null> {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.replace(/^Bearer\s+/i, "")
  if (!token) return null

  const conn = await prisma.directoryConnection.findFirst({
    where: { id: connectionId, type: "SCIM" },
    select: { encryptedConfig: true, companyId: true },
  })
  if (!conn) return null

  const config = decryptConfig<SCIMConfig>(conn.encryptedConfig)
  if (config.bearerToken !== token) return null

  return { companyId: conn.companyId }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ connectionId: string; scimId: string }> }
) {
  const { connectionId, scimId } = await params
  const ctx = await authenticate(req, connectionId)
  if (!ctx) return NextResponse.json({ status: 401, detail: "Unauthorized" }, { status: 401 })

  const body = (await req.json()) as SCIMPatch

  // Handle active=false (deactivation) — we don't delete, just acknowledge
  const deactivate = body.Operations?.some(
    (op) => op.path === "active" && op.value === false
  )
  if (deactivate) {
    return new NextResponse(null, { status: 204 })
  }

  const employee = await prisma.employee.findFirst({
    where: { id: scimId, companyId: ctx.companyId },
  })
  if (!employee) return NextResponse.json({ status: 404, detail: "User not found" }, { status: 404 })

  return NextResponse.json({
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: employee.id,
    userName: employee.email,
  })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ connectionId: string; scimId: string }> }
) {
  const { connectionId, scimId } = await params
  const ctx = await authenticate(req, connectionId)
  if (!ctx) return NextResponse.json({ status: 401, detail: "Unauthorized" }, { status: 401 })

  // We don't hard-delete employees as they may have breach records
  // Silently acknowledge the deletion to stay SCIM-compliant
  void scimId
  return new NextResponse(null, { status: 204 })
}
