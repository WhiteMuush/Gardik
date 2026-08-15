import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/apiAuth"
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
  const { session, error } = await requirePermission("policy:manage")
  if (error) return error

  const body = (await req.json()) as {
    scanIntervalMinutes?: unknown
    riskWeights?: unknown
    remediationEnabled?: unknown
    siemToken?: unknown
    siemPush?: unknown
  }
  const data: {
    scanIntervalMinutes?: number | null
    riskWeights?: RiskWeights
    remediationEnabled?: boolean
    siemTokenEnc?: string | null
    siemTokenHint?: string | null
    siemPushUrlEnc?: string | null
    siemPushHint?: string | null
    siemPushFormat?: string | null
    siemPushSince?: Date | null
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

  if ("siemPush" in body) {
    if (body.siemPush === null) {
      data.siemPushUrlEnc = null
      data.siemPushHint = null
      data.siemPushFormat = null
      data.siemPushSince = null
    } else {
      const push = body.siemPush as { url?: string; format?: string }
      let parsed: URL
      try {
        parsed = new URL(push.url ?? "")
      } catch {
        return NextResponse.json({ error: "Invalid push URL" }, { status: 400 })
      }
      if (parsed.protocol !== "https:")
        return NextResponse.json({ error: "Push URL must use https" }, { status: 400 })
      data.siemPushUrlEnc = encryptConfig({ url: parsed.toString() })
      data.siemPushHint = parsed.host
      data.siemPushFormat = push.format === "syslog" ? "syslog" : "cef"
      // Start the watermark now so the first push does not replay history.
      data.siemPushSince = new Date()
    }
  }

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })

  await prisma.company.update({ where: { id: session.user.companyId }, data })

  // Never echo encrypted secrets back; surface the hints instead.
  const { siemTokenEnc: _t, siemPushUrlEnc: _p, ...safe } = data
  void _t
  void _p
  return NextResponse.json(safe)
}
