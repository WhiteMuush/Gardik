import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { rateLimit } from "@/lib/rateLimit"
import { loadActiveProviders, runScan } from "@/lib/scan/runner"

const runningScans = new Set<string>()

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const companyId = session.user.companyId

  if (!rateLimit(`scan:${companyId}`, 5, 60_000)) {
    return NextResponse.json(
      { error: "Too many scans. Try again in a minute." },
      { status: 429 }
    )
  }

  const providers = await loadActiveProviders(companyId)
  if (!providers.length) {
    return NextResponse.json(
      { error: "No breach API key configured. Add one in Data API." },
      { status: 503 }
    )
  }

  if (runningScans.has(companyId)) {
    return NextResponse.json(
      { error: "A scan is already running for this company" },
      { status: 409 }
    )
  }

  runningScans.add(companyId)
  try {
    const result = await runScan(companyId, providers)
    return NextResponse.json(result)
  } finally {
    runningScans.delete(companyId)
  }
}
