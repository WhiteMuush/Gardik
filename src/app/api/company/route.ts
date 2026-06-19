import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

const MIN_INTERVAL_MINUTES = 5

function parseInterval(value: unknown): number | null | undefined {
  if (value === null) return null
  if (typeof value === "number" && Number.isInteger(value) && value >= MIN_INTERVAL_MINUTES)
    return value
  return undefined
}

// Set the company-wide auto-scan cadence. null disables scheduled scans.
export async function PATCH(req: Request) {
  const { session, error } = await requireAdmin()
  if (error) return error

  const body = (await req.json()) as { scanIntervalMinutes?: unknown }
  const interval = parseInterval(body.scanIntervalMinutes)
  if (interval === undefined)
    return NextResponse.json(
      { error: `scanIntervalMinutes must be null or an integer >= ${MIN_INTERVAL_MINUTES}` },
      { status: 400 }
    )

  await prisma.company.update({
    where: { id: session.user.companyId },
    data: { scanIntervalMinutes: interval },
  })
  return NextResponse.json({ scanIntervalMinutes: interval })
}
