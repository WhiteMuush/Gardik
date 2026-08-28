import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateScim, checkScimRateLimit } from "@/lib/directory/scim-auth"

type SCIMPatch = {
  Operations?: { op?: string; path?: string; value?: unknown }[]
}

// Detects a deactivation in both shapes RFC 7644 allows:
// { op: "replace", path: "active", value: false } or { op: "replace", value: { active: false } }.
// The op verb is matched case-insensitively ("Replace" / "replace").
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
  if (!(await checkScimRateLimit(connectionId)))
    return NextResponse.json({ status: 429, detail: "Too many requests" }, { status: 429 })
  const ctx = await authenticateScim(req, connectionId)
  if (!ctx) return NextResponse.json({ status: 401, detail: "Unauthorized" }, { status: 401 })

  const body = (await req.json()) as SCIMPatch

  // Deactivation: nothing is deleted, because employees carry breach history. Acknowledge instead.
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
  if (!(await checkScimRateLimit(connectionId)))
    return NextResponse.json({ status: 429, detail: "Too many requests" }, { status: 429 })
  const ctx = await authenticateScim(req, connectionId)
  if (!ctx) return NextResponse.json({ status: 401, detail: "Unauthorized" }, { status: 401 })

  // No hard delete, because breach history hangs off the employee. Acknowledge to stay SCIM-compliant.
  void scimId
  return new NextResponse(null, { status: 204 })
}
