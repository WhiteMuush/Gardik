import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateScim, checkScimRateLimit } from "@/lib/directory/scim-auth"

type SCIMPatch = {
  Operations?: { op?: string; path?: string; value?: unknown }[]
}

// Détecte une désactivation sous les deux formes prévues par la RFC 7644 :
// { op: "replace", path: "active", value: false } ou { op: "replace", value: { active: false } }.
// Le verbe op est traité sans tenir compte de la casse ("Replace" / "replace").
function isDeactivation(body: SCIMPatch): boolean {
  return (body.Operations ?? []).some((op) => {
    if (op.op?.toLowerCase() !== "replace") return false
    if (op.path === "active") return op.value === false
    if (!op.path && op.value && typeof op.value === "object") {
      return (op.value as Record<string, unknown>).active === false
    }
    return false
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ connectionId: string; scimId: string }> }
) {
  const { connectionId, scimId } = await params
  if (!checkScimRateLimit(connectionId))
    return NextResponse.json({ status: 429, detail: "Too many requests" }, { status: 429 })
  const ctx = await authenticateScim(req, connectionId)
  if (!ctx) return NextResponse.json({ status: 401, detail: "Unauthorized" }, { status: 401 })

  const body = (await req.json()) as SCIMPatch

  // Désactivation : on ne supprime pas (les employés portent des historiques de fuite), on acquitte.
  if (isDeactivation(body)) return new NextResponse(null, { status: 204 })

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
  if (!checkScimRateLimit(connectionId))
    return NextResponse.json({ status: 429, detail: "Too many requests" }, { status: 429 })
  const ctx = await authenticateScim(req, connectionId)
  if (!ctx) return NextResponse.json({ status: 401, detail: "Unauthorized" }, { status: 401 })

  // Pas de suppression dure (historiques de fuite liés) : on acquitte pour rester conforme SCIM.
  void scimId
  return new NextResponse(null, { status: 204 })
}
