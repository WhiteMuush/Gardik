import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const HIBP_API = "https://haveibeenpwned.com/api/v3/breachedaccount"
const RATE_LIMIT_MS = 1500

const runningScans = new Set<string>()

async function checkEmail(email: string, apiKey: string) {
  const res = await fetch(`${HIBP_API}/${encodeURIComponent(email)}?truncateResponse=false`, {
    headers: {
      "hibp-api-key": apiKey,
      "user-agent": "DataShield",
    },
  })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`HIBP error ${res.status}`)
  return res.json() as Promise<{ Name: string; BreachDate: string; DataClasses: string[] }[]>
}

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apiKey = process.env.HIBP_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "HIBP_API_KEY not configured" }, { status: 503 })
  }

  const companyId = session.user.companyId

  if (runningScans.has(companyId)) {
    return NextResponse.json({ error: "A scan is already running for this company" }, { status: 409 })
  }

  runningScans.add(companyId)

  try {
  const employees = await prisma.employee.findMany({
    where: { companyId },
    include: { breachRecords: { select: { breachId: true } } },
  })

  let newRecords = 0
  let newAlerts = 0

  for (const employee of employees) {
    const knownBreachIds = new Set(employee.breachRecords.map((r) => r.breachId))

    let findings: { Name: string; BreachDate: string; DataClasses: string[] }[]
    try {
      findings = await checkEmail(employee.email, apiKey)
    } catch {
      continue
    }

    for (const finding of findings) {
      const dataTypes = finding.DataClasses.map((d) => d.toLowerCase().replace(/ /g, "_"))

      const breach = await prisma.breach.upsert({
        where: { name: finding.Name },
        update: {},
        create: {
          name: finding.Name,
          source: "HIBP",
          breachDate: new Date(finding.BreachDate),
          dataTypes,
        },
      })

      if (knownBreachIds.has(breach.id)) continue

      await prisma.breachRecord.create({
        data: {
          employeeId: employee.id,
          breachId: breach.id,
          exposedData: dataTypes,
        },
      })

      const CRITICAL_TYPES = ["password", "credit_card", "ssn", "bank_account"]
      const hasCritical = dataTypes.some((d) => CRITICAL_TYPES.includes(d))
      const severity = hasCritical && newRecords > 1 ? "CRITICAL" : hasCritical ? "HIGH" : "MEDIUM"

      await prisma.alert.create({
        data: {
          companyId,
          employeeId: employee.id,
          breachId: breach.id,
          severity,
          status: "OPEN",
          message: `${employee.firstName} ${employee.lastName} found in ${finding.Name} breach.`,
        },
      })

      newRecords++
      newAlerts++
      knownBreachIds.add(breach.id)
    }

    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS))
  }

  return NextResponse.json({
    scanned: employees.length,
    newRecords,
    newAlerts,
  })
  } finally {
    runningScans.delete(companyId)
  }
}
