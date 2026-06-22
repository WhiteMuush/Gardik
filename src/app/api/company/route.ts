import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { resolveRiskWeights, type RiskWeights } from "@/lib/risk"
import { encryptConfig } from "@/lib/directory/crypto"

const MIN_INTERVAL_MINUTES = 5
const MIN_SIEM_TOKEN = 16

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
    siemToken?: unknown
  }
  const data: {
    scanIntervalMinutes?: number | null
    riskWeights?: RiskWeights
    remediationEnabled?: boolean
    siemTokenEnc?: string | null
    siemTokenHint?: string | null
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

  if ("siemToken" in body) {
    if (body.siemToken === null) {
      data.siemTokenEnc = null
      data.siemTokenHint = null
    } else if (typeof body.siemToken === "string" && body.siemToken.length >= MIN_SIEM_TOKEN) {
      data.siemTokenEnc = encryptConfig({ token: body.siemToken })
      data.siemTokenHint = `...${body.siemToken.slice(-4)}`
    } else {
      return NextResponse.json(
        { error: `siemToken must be null or a string of at least ${MIN_SIEM_TOKEN} characters` },
        { status: 400 }
      )
    }
  }

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })

  await prisma.company.update({ where: { id: session.user.companyId }, data })

  // Never echo the encrypted token back; surface the hint instead.
  const { siemTokenEnc: _omit, ...safe } = data
  void _omit
  return NextResponse.json(safe)
}
