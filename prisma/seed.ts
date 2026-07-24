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

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      role: "ADMIN",
      companyId: company.id,
    },
  })

  const credentialAccount = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  })
  if (credentialAccount) {
    await prisma.account.update({
      where: { id: credentialAccount.id },
      data: { password: hashedPassword },
    })
  } else {
    await prisma.account.create({
      data: {
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: hashedPassword,
      },
    })
  }

  console.log(`Seed complete: ${email} (change the password after first login)`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
