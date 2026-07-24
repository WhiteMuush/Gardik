// Dev-only: enrolls a dedicated user in TOTP two-factor by driving the real
// Better Auth HTTP flow, so the stored secret is encrypted the way the app
// expects. Prints the secret + backup codes so you can add the account to an
// authenticator app (or generate codes in tests). Requires the dev server
// running on BASE_URL. Admin stays password-only for quick local login.
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"
import { createOTP } from "@better-auth/utils/otp"
import { base32 } from "@better-auth/utils/base32"

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000"
const email = process.env.MFA_USER_EMAIL ?? "mfa@datashield.local"
const password = process.env.MFA_USER_PASSWORD ?? "ChangeMe123!"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

function cookieFrom(res: Response): string {
  const raw = res.headers.getSetCookie?.() ?? []
  return raw.map((c) => c.split(";")[0]).join("; ")
}

async function main() {
  const company = await prisma.company.upsert({
    where: { domain: "datashield.dev" },
    update: {},
    create: { name: "DataShield Dev", domain: "datashield.dev" },
  })

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "MFA Tester", role: "ADMIN", companyId: company.id },
  })

  const hashed = await bcrypt.hash(password, 12)
  const cred = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  })
  if (cred) {
    await prisma.account.update({ where: { id: cred.id }, data: { password: hashed } })
  } else {
    await prisma.account.create({
      data: { accountId: user.id, providerId: "credential", userId: user.id, password: hashed },
    })
  }

  // Already enrolled? Nothing to do; the secret is not recoverable after enroll.
  if ((await prisma.twoFactor.count({ where: { userId: user.id } })) > 0) {
    console.log(`OK ${email} already has 2FA. Delete its TwoFactor row to re-enroll.`)
    return
  }

  // 1) Sign in to get a session cookie.
  const signIn = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: BASE_URL },
    body: JSON.stringify({ email, password }),
  })
  if (!signIn.ok) throw new Error(`sign-in failed: ${signIn.status} ${await signIn.text()}`)
  const cookie = cookieFrom(signIn)

  // 2) Enable 2FA -> returns the otpauth URI (holds the secret) + backup codes.
  const enableRes = await fetch(`${BASE_URL}/api/auth/two-factor/enable`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: BASE_URL, cookie },
    body: JSON.stringify({ password }),
  })
  if (!enableRes.ok) throw new Error(`enable failed: ${enableRes.status} ${await enableRes.text()}`)
  const { totpURI, backupCodes } = (await enableRes.json()) as {
    totpURI: string
    backupCodes: string[]
  }

  const secret = new URL(totpURI).searchParams.get("secret")
  if (!secret) throw new Error("no secret in totpURI")

  // 3) Generate the current TOTP and verify to finalize enrollment. The URI
  // carries the base32-encoded secret; Better Auth runs TOTP over the original
  // secret string, so decode base32 back to UTF-8 or the code will not match.
  const rawSecret = new TextDecoder().decode(base32.decode(secret))
  const code = await createOTP(rawSecret).totp()
  const verifyRes = await fetch(`${BASE_URL}/api/auth/two-factor/verify-totp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: BASE_URL, cookie },
    body: JSON.stringify({ code }),
  })
  if (!verifyRes.ok) throw new Error(`verify failed: ${verifyRes.status} ${await verifyRes.text()}`)

  console.log("\n2FA enrolled")
  console.log(`  user:        ${email} / ${password}`)
  console.log(`  TOTP secret: ${secret}`)
  console.log(`  otpauth URI: ${totpURI}`)
  console.log(`  backup codes:\n    ${backupCodes.join("\n    ")}\n`)
  console.log("Add the secret to an authenticator app, or in a test compute a code with")
  console.log('  createOTP(secret).totp()  from "@better-auth/utils/otp"\n')
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
