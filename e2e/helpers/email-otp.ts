import type { APIRequestContext } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const ORIGIN = "http://localhost:3000"

// Reads the newest "2fa-otp-" verification row ("<code>:<attempts>"), deterministic as the serial suite has one email-code user.
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

// Signs in to a pending two-factor session and requests an email code, returning the status for the policy gate test.
export async function trySendEmailOtp(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<number> {
  const headers = { origin: ORIGIN }

  const signInRes = await request.post(`${ORIGIN}/api/auth/sign-in/email`, {
    data: { email, password },
    headers,
  })
  if (!signInRes.ok()) {
    throw new Error(`sign-in failed: ${signInRes.status()} ${await signInRes.text()}`)
  }

  // An empty JSON body sets the content-type, without which Better Auth answers 415 before the policy hook runs.
  const res = await request.post(`${ORIGIN}/api/auth/two-factor/send-otp`, {
    headers,
    data: {},
  })
  return res.status()
}
