import type { APIRequestContext, Page } from "@playwright/test"

const ORIGIN = "http://localhost:3000"

// CDP virtual authenticator with a resident, pre-verified key, living on the page target so it survives a cookie clear.
export async function addVirtualAuthenticator(page: Page): Promise<void> {
  const client = await page.context().newCDPSession(page)
  await client.send("WebAuthn.enable")
  await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })
}

// Requests passkey registration options after sign-in, returning the status for the policy gate test.
export async function tryGeneratePasskeyOptions(
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

  const res = await request.get(`${ORIGIN}/api/auth/passkey/generate-register-options`, {
    headers,
  })
  return res.status()
}
