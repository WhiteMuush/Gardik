import type { APIRequestContext, Page } from "@playwright/test"

const ORIGIN = "http://localhost:3000"

// Attaches a CDP virtual authenticator to the page so WebAuthn calls resolve
// without real hardware. A resident (discoverable) key with user verification
// pre-satisfied lets both registration and usernameless passkey sign-in run
// unattended: `automaticPresenceSimulation` answers the "touch your key" prompt.
// Chromium only, which is the single project this suite runs. The authenticator
// lives on the page's CDP target, so it survives a cookie clear and reload,
// which is how the round-trip test signs out then back in with the same key.
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

// Signs in, then requests passkey registration options (a GET behind a fresh
// session). Returns the status without asserting success so a test can check the
// policy gate refuses PASSKEY registration when the company has not allowed it.
export async function tryGeneratePasskeyOptions(
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

  const res = await request.get(`${ORIGIN}/api/auth/passkey/generate-register-options`, {
    headers,
  })
  return res.status()
}
