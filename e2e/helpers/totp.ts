import type { APIRequestContext } from "@playwright/test"
import { createOTP } from "@better-auth/utils/otp"
import { base32 } from "@better-auth/utils/base32"

const ORIGIN = "http://localhost:3000"

// Better Auth exposes the base32-encoded secret in the otpauth URI but runs
// TOTP over the original secret string, so decode back to UTF-8 before
// generating a code or it will not match.
export async function totpCode(secret: string): Promise<string> {
  return createOTP(new TextDecoder().decode(base32.decode(secret))).totp()
}

// Drives the real Better Auth enrollment flow (sign-in, enable, verify) and
// returns the TOTP secret so the caller can produce codes. Exercises the
// TwoFactor DB write that unit tests mock away.
export async function enrollTwoFactor(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const headers = { origin: ORIGIN }

  const signIn = await request.post(`${ORIGIN}/api/auth/sign-in/email`, {
    data: { email, password },
    headers,
  })
  if (!signIn.ok()) throw new Error(`sign-in failed: ${signIn.status()} ${await signIn.text()}`)

  const enable = await request.post(`${ORIGIN}/api/auth/two-factor/enable`, {
    data: { password },
    headers,
  })
  if (!enable.ok()) throw new Error(`enable failed: ${enable.status()} ${await enable.text()}`)

  const { totpURI } = (await enable.json()) as { totpURI: string }
  const secret = new URL(totpURI).searchParams.get("secret")
  if (!secret) throw new Error("no secret in totpURI")

  const verify = await request.post(`${ORIGIN}/api/auth/two-factor/verify-totp`, {
    data: { code: await totpCode(secret) },
    headers,
  })
  if (!verify.ok()) throw new Error(`verify failed: ${verify.status()} ${await verify.text()}`)

  return secret
}
