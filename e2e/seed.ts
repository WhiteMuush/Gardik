import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"
import { seedPresetsForCompany, resolvePresetRoleId } from "@/lib/rbac/seed-roles"
import { ADMINISTRATOR, VIEWER_ROLE } from "@/lib/rbac/presets"

// E2E fixtures for the CI job, run after prisma/seed.ts: one employee so the workspace counts as set up, plus a 2FA user.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const MFA_EMAIL = "mfa@gardik.local"
const MFA_PASSWORD = "ChangeMe123!"

const PASSKEY_EMAIL = "passkey@gardik.local"
const PASSKEY_PASSWORD = "ChangeMe123!"

const MANAGER_EMAIL = "manager@gardik.local"
const MANAGER_PASSWORD = "ChangeMe123!"

const MEMBER_EMAIL = "member@gardik.local"
const MEMBER_PASSWORD = "ChangeMe123!"

const NARROW_EMAIL = "narrow@gardik.local"
const NARROW_PASSWORD = "ChangeMe123!"

// Better Auth stores the password on a `credential` account row, so that row is upserted.
async function setPassword(userId: string, password: string): Promise<void> {
  const hashed = await bcrypt.hash(password, 12)
  const cred = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
  })
  if (cred) {
    await prisma.account.update({ where: { id: cred.id }, data: { password: hashed } })
  } else {
    await prisma.account.create({
      data: { accountId: userId, providerId: "credential", userId, password: hashed },
    })
  }
}

async function main() {
  const company = await prisma.company.findUniqueOrThrow({
    where: { domain: "gardik.dev" },
  })

  await prisma.employee.upsert({
    where: {
      email_companyId: { email: "jane.doe@gardik.dev", companyId: company.id },
    },
    update: {},
    create: {
      email: "jane.doe@gardik.dev",
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
  await setPassword(mfaUser.id, MFA_PASSWORD)

  // A manager with users:manage and roles:read but not roles:manage, plus a read-only member, for the read gate.
  const managerRoleId = await resolvePresetRoleId(prisma, company.id, "Security Manager")
  const manager = await prisma.user.upsert({
    where: { email: MANAGER_EMAIL },
    update: {},
    create: { email: MANAGER_EMAIL, name: "Manager", roleId: managerRoleId, companyId: company.id },
  })
  await setPassword(manager.id, MANAGER_PASSWORD)

  const viewerRoleId = await resolvePresetRoleId(prisma, company.id, VIEWER_ROLE)
  const member = await prisma.user.upsert({
    where: { email: MEMBER_EMAIL },
    update: {},
    create: { email: MEMBER_EMAIL, name: "Member", roleId: viewerRoleId, companyId: company.id },
  })
  await setPassword(member.id, MEMBER_PASSWORD)

  // Holds exactly two permissions, since every preset holds all ":read" ones and none can show a refusal.
  const narrowRole = await prisma.role.upsert({
    where: { companyId_name: { companyId: company.id, name: "E2E Narrow" } },
    update: { permissions: ["dashboard:read", "alerts:read"] },
    create: {
      name: "E2E Narrow",
      description: "Dashboard and alerts only. E2E fixture.",
      permissions: ["dashboard:read", "alerts:read"],
      companyId: company.id,
      isAssignable: true,
    },
  })
  const narrow = await prisma.user.upsert({
    where: { email: NARROW_EMAIL },
    update: { roleId: narrowRole.id },
    create: { email: NARROW_EMAIL, name: "Narrow", roleId: narrowRole.id, companyId: company.id },
  })
  await setPassword(narrow.id, NARROW_PASSWORD)

  // One register row, or the evidence control is absent for everybody and the assertion proves nothing.
  await prisma.exposureRegisterEntry.upsert({
    where: { id: "e2e-register-entry" },
    update: {},
    create: {
      id: "e2e-register-entry",
      companyId: company.id,
      title: "E2E fixture exposure",
      detectedAt: new Date("2026-01-15T00:00:00Z"),
      status: "ASSESSING",
      affectedCount: 3,
      dataCategories: ["email", "password"],
    },
  })

  // A separate company with PASSKEY allowed, so the passkey spec never races the two-factor spec's policy.
  const passkeyCompany = await prisma.company.upsert({
    where: { domain: "passkey.gardik.dev" },
    update: { allowedAuthMethods: ["PASSKEY", "TOTP"] },
    create: {
      name: "Gardik Passkey",
      domain: "passkey.gardik.dev",
      allowedAuthMethods: ["PASSKEY", "TOTP"],
    },
  })
  await seedPresetsForCompany(prisma, passkeyCompany.id)
  const passkeyAdminRoleId = await resolvePresetRoleId(prisma, passkeyCompany.id, ADMINISTRATOR)

  await prisma.employee.upsert({
    where: {
      email_companyId: { email: "sam.key@passkey.gardik.dev", companyId: passkeyCompany.id },
    },
    update: {},
    create: {
      email: "sam.key@passkey.gardik.dev",
      firstName: "Sam",
      lastName: "Key",
      department: "Security",
      companyId: passkeyCompany.id,
    },
  })

  const passkeyUser = await prisma.user.upsert({
    where: { email: PASSKEY_EMAIL },
    update: {},
    create: {
      email: PASSKEY_EMAIL,
      name: "Passkey Tester",
      roleId: passkeyAdminRoleId,
      companyId: passkeyCompany.id,
    },
  })
  await setPassword(passkeyUser.id, PASSKEY_PASSWORD)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
