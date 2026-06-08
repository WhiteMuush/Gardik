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

export async function fetchOktaUsers(config: OktaConfig): Promise<DirectoryUser[]> {
  const base = `https://${config.domain.replace(/\/$/, "")}`
  const users: DirectoryUser[] = []
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
      users.push({
        email: email.toLowerCase(),
        firstName: u.profile.firstName ?? "",
        lastName: u.profile.lastName ?? "",
        department: u.profile.department,
      })
    }

    const link: string = oktaRes.headers.get("link") ?? ""
    const next: RegExpMatchArray | null = link.match(/<([^>]+)>;\s*rel="next"/)
    url = next ? next[1] : null
  }

  return users
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
