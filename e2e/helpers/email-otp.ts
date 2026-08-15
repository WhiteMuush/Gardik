import type { APIRequestContext } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const ORIGIN = "http://localhost:3000"

// The two-factor OTP sub-mode stores the code in the verification table as
// `identifier: "2fa-otp-<opaque session key>"`, `value: "<code>:<attempts>"`,
// with the default "plain" storeOTP. The e2e suite runs serial and only one
// user drives the email-code path, so reading the most recent such row back is
// deterministic and lets the test assert the real send + verify round-trip
// (the dev fallback only logs the code, which Playwright cannot read).
export async function latestEmailOtp(): Promise<string> {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })
  try {
    const row = await prisma.verification.findFirst({
      where: { identifier: { startsWith: "2fa-otp-" } },
      orderBy: { createdAt: "desc" },
    })
    if (!row) throw new Error("no 2fa-otp verification row found")
    return row.value.split(":")[0]
  } finally {
    await prisma.$disconnect()
  }
}

// Signs in with a password (which, for a 2FA-enrolled user, returns a pending
// two-factor session) then requests an email code, returning the status so a
// test can assert the policy gate rejects EMAIL_OTP when it is not allowed.
export async function trySendEmailOtp(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<number> {
  const headers = { origin: ORIGIN }

  const signInRes = await request.post(`${ORIGIN}/api/auth/sign-in/email`, {
    data: { email, password },
    headers,
  })
  if (!signInRes.ok()) {
    throw new Error(`sign-in failed: ${signInRes.status()} ${await signInRes.text()}`)
  }

  // Send an empty JSON body so the request carries an application/json
  // content-type; without it Better Auth rejects the POST with 415 before the
  // policy hook (which is what this call is meant to exercise) ever runs.
  const res = await request.post(`${ORIGIN}/api/auth/two-factor/send-otp`, {
    headers,
    data: {},
  })
  return res.status()
}
