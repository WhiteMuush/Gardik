import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const email = process.env.SEED_ADMIN_EMAIL ?? "admin@datashield.local"
const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!"

async function main() {
  const company = await prisma.company.upsert({
    where: { domain: "datashield.dev" },
    update: {},
    create: { name: "DataShield Dev", domain: "datashield.dev" },
  })

  const hashedPassword = await bcrypt.hash(password, 12)

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      hashedPassword,
      role: "ADMIN",
      companyId: company.id,
    },
  })

  console.log(`Seed complete: ${email} (change the password after first login)`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
