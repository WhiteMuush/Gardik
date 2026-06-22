import type { OktaConfig, DirectoryUser, TestResult } from "./types"

type OktaUser = {
  id: string
  status: string
  profile: {
    login: string
    email: string
    firstName: string
    lastName: string
    department?: string
  }
}

// Bound the per-user MFA fan-out so a large directory does not open hundreds of
// concurrent requests or trip Okta rate limits.
const MFA_CONCURRENCY = 8

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

// Okta has no MFA flag on the user; enrollment means at least one active factor.
// Returns undefined (unknown) on any error so a sync never fails over MFA.
async function fetchOktaMfaEnabled(base: string, token: string, userId: string): Promise<boolean | undefined> {
  try {
    const res = await fetch(`${base}/api/v1/users/${userId}/factors`, {
      headers: { Authorization: `SSWS ${token}`, Accept: "application/json" },
    })
    if (!res.ok) return undefined
    const factors = (await res.json()) as { status?: string }[]
    return factors.some((f) => f.status === "ACTIVE")
  } catch {
    return undefined
  }
}

export async function fetchOktaUsers(config: OktaConfig): Promise<DirectoryUser[]> {
  const base = `https://${config.domain.replace(/\/$/, "")}`
  const raw: { id: string; user: DirectoryUser }[] = []
  let url: string | null =
    `${base}/api/v1/users?filter=status+eq+"ACTIVE"&limit=200`

  while (url) {
    const oktaRes = await fetch(url, {
      headers: {
        Authorization: `SSWS ${config.apiToken}`,
        Accept: "application/json",
      },
    })
    if (!oktaRes.ok) throw new Error(`Okta API error (${oktaRes.status}): ${await oktaRes.text()}`)

    const data = (await oktaRes.json()) as OktaUser[]
    for (const u of data) {
      const email = u.profile.email || u.profile.login
      if (!email) continue
      raw.push({
        id: u.id,
        user: {
          email: email.toLowerCase(),
          firstName: u.profile.firstName ?? "",
          lastName: u.profile.lastName ?? "",
          department: u.profile.department,
        },
      })
    }

    const link: string = oktaRes.headers.get("link") ?? ""
    const next: RegExpMatchArray | null = link.match(/<([^>]+)>;\s*rel="next"/)
    url = next ? next[1] : null
  }

  await mapPool(raw, MFA_CONCURRENCY, async ({ id, user }) => {
    user.mfaEnabled = await fetchOktaMfaEnabled(base, config.apiToken, id)
  })

  return raw.map((r) => r.user)
}

function oktaBase(config: OktaConfig): string {
  return `https://${config.domain.replace(/\/$/, "")}`
}

// Clear all of a user's active sessions. Okta resolves the login/email as the
// user id in the path.
export async function oktaRevokeSessions(config: OktaConfig, email: string): Promise<void> {
  const res = await fetch(`${oktaBase(config)}/api/v1/users/${encodeURIComponent(email)}/sessions`, {
    method: "DELETE",
    headers: { Authorization: `SSWS ${config.apiToken}`, Accept: "application/json" },
  })
  if (!res.ok) throw new Error(`Okta clear sessions failed (${res.status})`)
}

// Expire the user's password, forcing a change at next sign-in.
export async function oktaExpirePassword(config: OktaConfig, email: string): Promise<void> {
  const res = await fetch(
    `${oktaBase(config)}/api/v1/users/${encodeURIComponent(email)}/lifecycle/expire_password`,
    { method: "POST", headers: { Authorization: `SSWS ${config.apiToken}`, Accept: "application/json" } }
  )
  if (!res.ok) throw new Error(`Okta expire password failed (${res.status})`)
}

export async function testOktaConnection(config: OktaConfig): Promise<TestResult> {
  try {
    const base = `https://${config.domain.replace(/\/$/, "")}`
    const res = await fetch(
      `${base}/api/v1/users?filter=status+eq+"ACTIVE"&limit=1`,
      {
        headers: {
          Authorization: `SSWS ${config.apiToken}`,
          Accept: "application/json",
        },
      }
    )
    if (!res.ok) throw new Error(`Okta API error (${res.status}): ${await res.text()}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
