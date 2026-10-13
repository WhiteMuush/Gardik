import { appBaseUrl } from "@/lib/appUrl"

// E2E runs a production build, so only E2E=1 with a loopback base URL disables rate limiting; unset never counts.
function isLoopbackAuthUrl(): boolean {
  if (!process.env.AUTH_URL && !process.env.BETTER_AUTH_URL) return false
  try {
    const host = new URL(appBaseUrl()).hostname
    return host === "localhost" || host === "127.0.0.1" || host === "::1"
  } catch {
    return false
  }
}

export const rateLimitDisabled = process.env.E2E === "1" && isLoopbackAuthUrl()

// Under Vitest only, the SSO SSRF guard trusts loopback so the local stub identity provider is reachable.
export const testTrustedOrigins = process.env.NODE_ENV === "test" ? ["http://127.0.0.1:*"] : []

// Passkeys are bound to the base URL host, so a passkey registered under one host fails under another.
export function webauthnConfig(): { rpID: string; origin: string } {
  try {
    const url = new URL(appBaseUrl())
    return { rpID: url.hostname, origin: url.origin }
  } catch {
    return { rpID: "localhost", origin: "http://localhost:3000" }
  }
}
