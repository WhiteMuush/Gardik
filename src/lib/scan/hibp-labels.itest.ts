import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { readFileSync } from "node:fs"
import pg from "pg"
import { prisma } from "@/lib/prisma"

const MIGRATION = "prisma/migrations/20261014120000_canonical_hibp_data_classes/migration.sql"

let companyId: string
let employeeId: string
const breachIds: string[] = []

async function seed(name: string, labels: string[], severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") {
  const breach = await prisma.breach.create({
    data: { name: `${name}-${Date.now()}`, breachDate: new Date("2020-01-01"), dataTypes: labels },
  })
  breachIds.push(breach.id)
  await prisma.breachRecord.create({
    data: { employeeId, breachId: breach.id, exposedData: labels, artifacts: [], sources: ["HIBP"] },
  })
  const alert = await prisma.alert.create({
    data: { companyId, employeeId, breachId: breach.id, severity, message: name },
  })
  return { breachId: breach.id, alertId: alert.id }
}

beforeAll(async () => {
  const c = await prisma.company.create({
    data: { name: "HIBP Labels Co", domain: `labels-${Date.now()}.test` },
  })
  companyId = c.id
  const e = await prisma.employee.create({
    data: { email: "ada@labels.test", firstName: "Ada", lastName: "L", companyId },
  })
  employeeId = e.id
})

afterAll(async () => {
  await prisma.breach.deleteMany({ where: { id: { in: breachIds } } })
  await prisma.company.delete({ where: { id: companyId } })
})

// Runs the migration file itself, as migrate deploy would, against rows written before the HIBP fix.
async function migrate() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  await client.query(readFileSync(MIGRATION, "utf8"))
  await client.end()
}

describe("canonical HIBP data classes migration", () => {
  it("renames the plural labels and raises the alerts they kept too low", async () => {
    const one = await seed("one", ["email_addresses", "passwords"], "MEDIUM")
    const two = await seed("two", ["credit_cards", "social_security_numbers", "credit_card"], "MEDIUM")
    const kept = await seed("kept", ["passwords"], "CRITICAL")

    await migrate()

    const record = await prisma.breachRecord.findFirst({ where: { breachId: two.breachId } })
    expect(record?.exposedData).toEqual(["credit_card", "ssn"])
    const breach = await prisma.breach.findUnique({ where: { id: one.breachId } })
    expect(breach?.dataTypes).toEqual(["email_addresses", "password"])
    const severity = async (id: string) => (await prisma.alert.findUnique({ where: { id } }))?.severity
    expect(await severity(one.alertId)).toBe("HIGH")
    expect(await severity(two.alertId)).toBe("CRITICAL")
    expect(await severity(kept.alertId)).toBe("CRITICAL")
  })
})
