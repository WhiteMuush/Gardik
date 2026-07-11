import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// E2E fixture: one employee so a fresh instance counts as set up
// (the dashboard redirects empty workspaces to /setup). Run after
// prisma/seed.ts; used by the CI e2e job only.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const company = await prisma.company.findUniqueOrThrow({
    where: { domain: "datashield.dev" },
  })

  await prisma.employee.upsert({
    where: {
      email_companyId: { email: "jane.doe@datashield.dev", companyId: company.id },
    },
    update: {},
    create: {
      email: "jane.doe@datashield.dev",
      firstName: "Jane",
      lastName: "Doe",
      department: "Engineering",
      companyId: company.id,
    },
  })

}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
