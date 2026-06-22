import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { runDueSchedules } from "@/lib/scheduler"
import { runDueReportSchedules } from "@/lib/reportSchedules"

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

// Scheduler tick. Meant to be called by an external cron (system cron, Vercel
// Cron, uptime pinger) on a fixed interval, authenticated with CRON_SECRET:
//   curl -X POST -H "authorization: Bearer $CRON_SECRET" https://host/api/cron
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret)
    return NextResponse.json({ error: "Scheduler not configured" }, { status: 503 })

  const provided = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(\S.*)$/i)?.[1]
  if (!provided || !safeEqual(provided, secret))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await runDueSchedules()
  const { sent } = await runDueReportSchedules()
  return NextResponse.json({ ...result, reportsSent: sent })
}
