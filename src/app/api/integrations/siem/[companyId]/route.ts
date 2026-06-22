import { NextResponse } from "next/server"
import { authenticateSiem, checkSiemRateLimit, getSiemAlerts } from "@/lib/siem"
import { CONTENT_TYPE, formatAlerts, type SiemFormat } from "@/lib/integrations"

const FORMATS: SiemFormat[] = ["cef", "syslog", "json"]

// Authenticated pull feed for SIEM/SOAR ingestion. Splunk, Sentinel or any
// collector polls this with the company's bearer export token.
export async function GET(req: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params

  if (!checkSiemRateLimit(companyId))
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })

  if (!(await authenticateSiem(req, companyId)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const formatParam = url.searchParams.get("format") ?? "json"
  const format = (FORMATS as string[]).includes(formatParam) ? (formatParam as SiemFormat) : "json"

  const sinceParam = url.searchParams.get("since")
  const since = sinceParam ? new Date(sinceParam) : undefined
  const validSince = since && !Number.isNaN(since.getTime()) ? since : undefined

  const alerts = await getSiemAlerts(companyId, validSince)
  return new NextResponse(formatAlerts(alerts, format), {
    status: 200,
    headers: { "Content-Type": CONTENT_TYPE[format] },
  })
}
