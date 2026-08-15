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

async function signIn(request: APIRequestContext, email: string, password: string) {
  const res = await request.post(`${ORIGIN}/api/auth/sign-in/email`, {
    data: { email, password },
    headers: { origin: ORIGIN },
  })
  if (!res.ok()) throw new Error(`sign-in failed: ${res.status()} ${await res.text()}`)
}

// Signs in as the given admin and sets the company's allowed auth methods.
export async function setAllowedMethods(
  request: APIRequestContext,
  admin: { email: string; password: string },
  methods: string[],
): Promise<void> {
  await signIn(request, admin.email, admin.password)
  const res = await request.fetch(`${ORIGIN}/api/company/auth-policy`, {
    method: "PATCH",
    data: { allowedAuthMethods: methods },
    headers: { origin: ORIGIN },
  })
  if (!res.ok()) throw new Error(`policy update failed: ${res.status()} ${await res.text()}`)
}

// Returns the status of a two-factor enable attempt without asserting success,
// so a test can check the policy gate rejects a disallowed method.
export async function tryEnableTotp(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<number> {
  await signIn(request, email, password)
  const res = await request.post(`${ORIGIN}/api/auth/two-factor/enable`, {
    data: { password },
    headers: { origin: ORIGIN },
  })
  return res.status()
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

  const signInRes = await request.post(`${ORIGIN}/api/auth/sign-in/email`, {
    data: { email, password },
    headers,
  })
  if (!signInRes.ok()) throw new Error(`sign-in failed: ${signInRes.status()} ${await signInRes.text()}`)

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
