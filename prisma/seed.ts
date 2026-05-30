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

  console.log("Seed complete — melvin.petit31@gmail.com / Passw@rd")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
