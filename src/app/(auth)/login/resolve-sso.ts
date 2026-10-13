// A stalled lookup must not keep the anti-lockout escape hatch disabled, so it is abandoned after 5s.
const RESOLVE_TIMEOUT_MS = 5000

// Only the error codes a real user can reach are translated; the raw code stays server-side.
export const SSO_ERRORS: Record<string, string> = {
  "account not linked":
    "This company's domain is not verified yet. Ask an administrator to finish the SSO setup.",
  signup_disabled: "No Gardik account exists for this address. Ask an administrator to create it.",
  invalid_provider:
    "The identity provider rejected the sign-in. Ask an administrator to check the SSO configuration.",
}

export const SSO_FAILED = "Single sign-on failed. Try again or contact an administrator."

// Any failure (network, non-JSON, timeout) counts as "no SSO", so the lookup can never lock anyone out.
export async function resolveSso(email: string): Promise<{ sso?: boolean; providerId?: string } | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS)
  try {
    const res = await fetch("/api/sso/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
      signal: controller.signal,
    })
    return res.ok ? ((await res.json()) as { sso?: boolean; providerId?: string }) : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
