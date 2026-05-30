import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const company = await prisma.company.upsert({
    where: { domain: "datashield.dev" },
    update: {},
    create: { name: "DataShield Dev", domain: "datashield.dev" },
  })

  const hashedPassword = await bcrypt.hash("Passw@rd", 12)
  await prisma.user.upsert({
    where: { email: "melvin.petit31@gmail.com" },
    update: {},
    create: {
      email: "melvin.petit31@gmail.com",
      hashedPassword,
      role: "ADMIN",
      companyId: company.id,
    },
  })

  // Breaches
  const breaches = await Promise.all([
    prisma.breach.upsert({
      where: { name: "LinkedIn 2021" },
      update: {},
      create: {
        name: "LinkedIn 2021",
        source: "HIBP",
        breachDate: new Date("2021-06-22"),
        description: "700M LinkedIn profiles scraped and sold.",
        dataTypes: ["email", "phone", "address", "geolocation"],
      },
    }),
    prisma.breach.upsert({
      where: { name: "Adobe 2013" },
      update: {},
      create: {
        name: "Adobe 2013",
        source: "HIBP",
        breachDate: new Date("2013-10-04"),
        description: "153M Adobe accounts exposed.",
        dataTypes: ["email", "password", "username"],
      },
    }),
    prisma.breach.upsert({
      where: { name: "RockYou 2024" },
      update: {},
      create: {
        name: "RockYou 2024",
        source: "DARK_WEB",
        breachDate: new Date("2024-07-04"),
        description: "10B plaintext passwords leaked.",
        dataTypes: ["password", "email"],
      },
    }),
    prisma.breach.upsert({
      where: { name: "Dropbox 2012" },
      update: {},
      create: {
        name: "Dropbox 2012",
        source: "HIBP",
        breachDate: new Date("2012-07-01"),
        description: "68M Dropbox credentials exposed.",
        dataTypes: ["email", "password"],
      },
    }),
  ])

  // Employees
  const employees = [
    { email: "alice.martin@datashield.dev", firstName: "Alice", lastName: "Martin", department: "Engineering" },
    { email: "bob.dupont@datashield.dev", firstName: "Bob", lastName: "Dupont", department: "Engineering" },
    { email: "claire.bernard@datashield.dev", firstName: "Claire", lastName: "Bernard", department: "Marketing" },
    { email: "david.leroy@datashield.dev", firstName: "David", lastName: "Leroy", department: "Sales" },
    { email: "emma.petit@datashield.dev", firstName: "Emma", lastName: "Petit", department: "HR" },
    { email: "francois.moreau@datashield.dev", firstName: "François", lastName: "Moreau", department: "Finance" },
    { email: "grace.simon@datashield.dev", firstName: "Grace", lastName: "Simon", department: "Engineering" },
    { email: "hugo.laurent@datashield.dev", firstName: "Hugo", lastName: "Laurent", department: "Sales" },
  ]

  const created = await Promise.all(
    employees.map((e) =>
      prisma.employee.upsert({
        where: { email_companyId: { email: e.email, companyId: company.id } },
        update: {},
        create: { ...e, companyId: company.id },
      })
    )
  )

  // Breach records
  const records: { employeeId: string; breachId: string; exposedData: string[]; detectedAt: Date }[] = [
    { employeeId: created[0].id, breachId: breaches[0].id, exposedData: ["email", "phone"], detectedAt: new Date("2024-01-15") },
    { employeeId: created[0].id, breachId: breaches[1].id, exposedData: ["email", "password"], detectedAt: new Date("2024-02-03") },
    { employeeId: created[1].id, breachId: breaches[2].id, exposedData: ["password", "email"], detectedAt: new Date("2024-07-10") },
    { employeeId: created[2].id, breachId: breaches[0].id, exposedData: ["email", "address"], detectedAt: new Date("2024-03-20") },
    { employeeId: created[3].id, breachId: breaches[3].id, exposedData: ["email", "password"], detectedAt: new Date("2023-11-05") },
    { employeeId: created[3].id, breachId: breaches[1].id, exposedData: ["email", "password", "username"], detectedAt: new Date("2024-01-28") },
    { employeeId: created[5].id, breachId: breaches[2].id, exposedData: ["password", "email"], detectedAt: new Date("2024-08-01") },
  ]

  for (const record of records) {
    await prisma.breachRecord.upsert({
      where: { employeeId_breachId: { employeeId: record.employeeId, breachId: record.breachId } },
      update: {},
      create: record,
    })
  }

  // Alerts for compromised employees
  await prisma.alert.createMany({
    skipDuplicates: true,
    data: [
      {
        companyId: company.id,
        employeeId: created[0].id,
        breachId: breaches[1].id,
        severity: "HIGH",
        status: "OPEN",
        message: "Alice Martin's credentials found in Adobe 2013 breach.",
      },
      {
        companyId: company.id,
        employeeId: created[1].id,
        breachId: breaches[2].id,
        severity: "CRITICAL",
        status: "OPEN",
        message: "Bob Dupont's password found in RockYou 2024 leak.",
      },
      {
        companyId: company.id,
        employeeId: created[3].id,
        breachId: breaches[1].id,
        severity: "HIGH",
        status: "ACKNOWLEDGED",
        message: "David Leroy exposed in multiple breaches.",
      },
    ],
  })

  console.log("Seed complete — melvin.petit31@gmail.com / Passw@rd")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
