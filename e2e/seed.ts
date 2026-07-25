import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"
import { resolvePresetRoleId } from "@/lib/rbac/seed-roles"
import { ADMINISTRATOR } from "@/lib/rbac/presets"

// E2E fixture: one employee so a fresh instance counts as set up
// (the dashboard redirects empty workspaces to /setup), plus a dedicated
// user the two-factor spec enrolls so the admin stays password-only.
// Run after prisma/seed.ts; used by the CI e2e job only.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const MFA_EMAIL = "mfa@datashield.local"
const MFA_PASSWORD = "ChangeMe123!"

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

  const adminRoleId = await resolvePresetRoleId(prisma, company.id, ADMINISTRATOR)

  const mfaUser = await prisma.user.upsert({
    where: { email: MFA_EMAIL },
    update: {},
    create: { email: MFA_EMAIL, name: "MFA Tester", roleId: adminRoleId, companyId: company.id },
  })

  const hashedPassword = await bcrypt.hash(MFA_PASSWORD, 12)
  const cred = await prisma.account.findFirst({
    where: { userId: mfaUser.id, providerId: "credential" },
  })
  if (cred) {
    await prisma.account.update({ where: { id: cred.id }, data: { password: hashedPassword } })
  } else {
    await prisma.account.create({
      data: {
        accountId: mfaUser.id,
        providerId: "credential",
        userId: mfaUser.id,
        password: hashedPassword,
      },
    })
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
