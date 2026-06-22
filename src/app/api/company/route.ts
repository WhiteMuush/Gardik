import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { resolveRiskWeights, type RiskWeights } from "@/lib/risk"

const MIN_INTERVAL_MINUTES = 5

function parseInterval(value: unknown): number | null | undefined {
  if (value === null) return null
  if (typeof value === "number" && Number.isInteger(value) && value >= MIN_INTERVAL_MINUTES)
    return value
  return undefined
}

// Update company-wide settings: auto-scan cadence (null disables scheduled
// scans) and/or the per-employee risk weights.
export async function PATCH(req: Request) {
  const { session, error } = await requireAdmin()
  if (error) return error

  const body = (await req.json()) as {
    scanIntervalMinutes?: unknown
    riskWeights?: unknown
    remediationEnabled?: unknown
  }
  const data: {
    scanIntervalMinutes?: number | null
    riskWeights?: RiskWeights
    remediationEnabled?: boolean
  } = {}

  if ("scanIntervalMinutes" in body) {
    const interval = parseInterval(body.scanIntervalMinutes)
    if (interval === undefined)
      return NextResponse.json(
        { error: `scanIntervalMinutes must be null or an integer >= ${MIN_INTERVAL_MINUTES}` },
        { status: 400 }
      )
    data.scanIntervalMinutes = interval
  }

  if ("riskWeights" in body) {
    if (!body.riskWeights || typeof body.riskWeights !== "object")
      return NextResponse.json({ error: "riskWeights must be an object" }, { status: 400 })
    data.riskWeights = resolveRiskWeights(body.riskWeights)
  }

  if ("remediationEnabled" in body) {
    if (typeof body.remediationEnabled !== "boolean")
      return NextResponse.json({ error: "remediationEnabled must be a boolean" }, { status: 400 })
    data.remediationEnabled = body.remediationEnabled
  }

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })

  await prisma.company.update({ where: { id: session.user.companyId }, data })
  return NextResponse.json(data)
}
