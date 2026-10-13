import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/apiAuth"
import { alertDetail, breachDetail, employeeDetail } from "@/lib/entity-detail/builders"

// Full record behind a dashboard drawer, fetched on click since widget rows carry only a summary.
const BUILDERS = { employee: employeeDetail, breach: breachDetail, alert: alertDetail } as const

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { session, error } = await requirePermission("employees:read")
  if (error) return error

  const { kind, id } = await params
  if (!Object.hasOwn(BUILDERS, kind))
    return NextResponse.json({ error: "Unknown detail kind" }, { status: 400 })
  const detail = await BUILDERS[kind as keyof typeof BUILDERS](id, session.user.companyId)
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(detail)
}
