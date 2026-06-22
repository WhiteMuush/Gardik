import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { remediateAlert } from "@/lib/remediation"
import { RemediationType } from "@prisma/client"

const ERROR_STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  NO_EMPLOYEE: 400,
  NO_CAPABLE_CONNECTION: 400,
}

const ERROR_MESSAGE: Record<string, string> = {
  NOT_FOUND: "Alert not found",
  NO_EMPLOYEE: "Alert has no linked employee to remediate",
  NO_CAPABLE_CONNECTION: "No active directory connection supports this action",
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdmin()
  if (error) return error

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { remediationEnabled: true },
  })
  if (!company?.remediationEnabled)
    return NextResponse.json(
      { error: "Remediation is disabled. Enable it in settings first." },
      { status: 403 }
    )

  const body = (await req.json()) as { action?: string }
  if (!body.action || !(body.action in RemediationType))
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })

  const { id } = await params
  const result = await remediateAlert({
    companyId: session.user.companyId,
    alertId: id,
    action: body.action as RemediationType,
    performedBy: session.user.id ?? null,
  })

  if (!result.ok)
    return NextResponse.json({ error: ERROR_MESSAGE[result.code] }, { status: ERROR_STATUS[result.code] })

  const status = result.outcome.status === "SUCCESS" ? 200 : 502
  return NextResponse.json(result.outcome, { status })
}
