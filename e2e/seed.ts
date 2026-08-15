import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"
import { seedPresetsForCompany, resolvePresetRoleId } from "@/lib/rbac/seed-roles"
import { ADMINISTRATOR, VIEWER_ROLE } from "@/lib/rbac/presets"

// E2E fixture: one employee so a fresh instance counts as set up
// (the dashboard redirects empty workspaces to /setup), plus a dedicated
// user the two-factor spec enrolls so the admin stays password-only.
// Run after prisma/seed.ts; used by the CI e2e job only.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const MFA_EMAIL = "mfa@datashield.local"
const MFA_PASSWORD = "ChangeMe123!"

const PASSKEY_EMAIL = "passkey@datashield.local"
const PASSKEY_PASSWORD = "ChangeMe123!"

const MANAGER_EMAIL = "manager@datashield.local"
const MANAGER_PASSWORD = "ChangeMe123!"

const MEMBER_EMAIL = "member@datashield.local"
const MEMBER_PASSWORD = "ChangeMe123!"

const NARROW_EMAIL = "narrow@datashield.local"
const NARROW_PASSWORD = "ChangeMe123!"

// Sets (or resets) the credential-provider password for a user. Better Auth
// stores it on a `credential` account row, so upsert that row rather than the
// user.
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
  await setPassword(mfaUser.id, MFA_PASSWORD)

  // RBAC fixtures in the shared company: a manager holding users:manage and
  // roles:read but NOT roles:manage, and a plain read-only member. The rbac
  // spec uses them to assert the read gate from the outside.
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

  // Narrow fixture: every preset role holds all the ":read" permissions, so
  // none of them can show what happens to a user who lacks one. This role holds
  // exactly two, which is what lets the rbac spec type a forbidden address into
  // the bar and assert the page refuses rather than renders.
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

  // Passkey fixture: its own company so the passkey spec can flip PASSKEY in and
  // out of allowedAuthMethods without racing the two-factor spec, which mutates
  // the shared datashield.dev policy. Seeded with PASSKEY allowed so enrollment
  // works out of the box; the gate test removes it temporarily. One employee so
  // the workspace counts as set up and /dashboard does not bounce to /setup.
  const passkeyCompany = await prisma.company.upsert({
    where: { domain: "passkey.datashield.dev" },
    update: { allowedAuthMethods: ["PASSKEY", "TOTP"] },
    create: {
      name: "DataShield Passkey",
      domain: "passkey.datashield.dev",
      allowedAuthMethods: ["PASSKEY", "TOTP"],
    },
  })
  await seedPresetsForCompany(prisma, passkeyCompany.id)
  const passkeyAdminRoleId = await resolvePresetRoleId(prisma, passkeyCompany.id, ADMINISTRATOR)

  await prisma.employee.upsert({
    where: {
      email_companyId: { email: "sam.key@passkey.datashield.dev", companyId: passkeyCompany.id },
    },
    update: {},
    create: {
      email: "sam.key@passkey.datashield.dev",
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
