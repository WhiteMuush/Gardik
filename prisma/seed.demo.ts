import { PrismaClient, type AlertStatus } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { normalizeType } from "@/lib/scan/normalize"
import { severityFor } from "@/lib/scan/runner"
import { DEMO_BREACHES } from "./demo/breaches"
import { DEMO_DOMAIN, DEMO_PEOPLE } from "./demo/people"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// Runs after seed.ts, which creates the company and the admin who sees this data.
const COMPANY_DOMAIN = "gardik.dev"

// Every third alert is acknowledged and every fifth resolved, so each status shows up.
function statusFor(index: number): AlertStatus {
  if (index % 5 === 4) return "RESOLVED"
  if (index % 3 === 2) return "ACKNOWLEDGED"
  return "OPEN"
}

async function main() {
  const company = await prisma.company.findUniqueOrThrow({ where: { domain: COMPANY_DOMAIN } })

  const breaches = new Map<string, { id: string; types: string[] }>()
  for (const b of DEMO_BREACHES) {
    const types = b.classes.map(normalizeType)
    const row = await prisma.breach.upsert({
      where: { name: b.name },
      update: {},
      create: {
        name: b.name,
        source: "HIBP",
        breachDate: new Date(b.date),
        description: `${b.accounts.toLocaleString("en-US")} accounts, per Have I Been Pwned.`,
        dataTypes: types,
      },
    })
    breaches.set(b.name, { id: row.id, types })
  }

  let alertIndex = 0
  for (const p of DEMO_PEOPLE) {
    const email = `${p.first}.${p.last}@${DEMO_DOMAIN}`.toLowerCase()
    const employee = await prisma.employee.upsert({
      where: { email_companyId: { email, companyId: company.id } },
      update: {},
      create: {
        email,
        firstName: p.first,
        lastName: p.last,
        department: p.department,
        companyId: company.id,
      },
    })
    await prisma.alert.deleteMany({ where: { employeeId: employee.id } })

    for (const name of p.breaches) {
      const breach = breaches.get(name)!
      await prisma.breachRecord.upsert({
        where: { employeeId_breachId: { employeeId: employee.id, breachId: breach.id } },
        update: {},
        create: {
          employeeId: employee.id,
          breachId: breach.id,
          exposedData: breach.types,
          artifacts: [],
          sources: ["HIBP"],
        },
      })
      await prisma.alert.create({
        data: {
          companyId: company.id,
          employeeId: employee.id,
          breachId: breach.id,
          severity: severityFor(breach.types, [], "HIBP"),
          confidence: "HIGH",
          status: statusFor(alertIndex++),
          message: `${p.first} ${p.last} found in ${name} breach.`,
        },
      })
    }
  }

  console.log(
    `Demo data: ${DEMO_PEOPLE.length} employees, ${DEMO_BREACHES.length} breaches, ${alertIndex} alerts`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
