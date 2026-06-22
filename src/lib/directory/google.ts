import { createSign } from "crypto"
import type { GoogleWorkspaceConfig, DirectoryUser, TestResult } from "./types"

async function getToken(config: GoogleWorkspaceConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(
    JSON.stringify({
      iss: config.serviceAccountEmail,
      sub: config.delegatedAdminEmail,
      scope: "https://www.googleapis.com/auth/admin.directory.user.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url")

  const sign = createSign("RSA-SHA256")
  sign.update(`${header}.${payload}`)
  // privateKey may arrive with literal \n — normalize them
  const privateKey = config.privateKey.replace(/\\n/g, "\n")
  const signature = sign.sign(privateKey, "base64url")

  const jwt = `${header}.${payload}.${signature}`

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error_description ?? `Google auth failed (${res.status})`)
  }
  const data = await res.json()
  return data.access_token as string
}

export async function fetchGoogleUsers(config: GoogleWorkspaceConfig): Promise<DirectoryUser[]> {
  const token = await getToken(config)
  const users: DirectoryUser[] = []
  let pageToken: string | null = null

  do {
    const url = new URL("https://admin.googleapis.com/admin/directory/v1/users")
    url.searchParams.set("domain", config.domain)
    url.searchParams.set("maxResults", "500")
    url.searchParams.set("query", "isSuspended=false")
    if (pageToken) url.searchParams.set("pageToken", pageToken)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Directory API error (${res.status})`)
    const data = await res.json()

    for (const u of data.users ?? []) {
      const email = (u.primaryEmail as string | undefined)?.toLowerCase()
      if (!email) continue
      users.push({
        email,
        firstName: u.name?.givenName ?? "",
        lastName: u.name?.familyName ?? "",
        department: u.organizations?.[0]?.department ?? undefined,
        // isEnrolledIn2Sv is part of the user resource (full projection); only
        // trust it when present as a boolean, leave unknown otherwise.
        mfaEnabled: typeof u.isEnrolledIn2Sv === "boolean" ? u.isEnrolledIn2Sv : undefined,
      })
    }
    pageToken = (data.nextPageToken as string | undefined) ?? null
  } while (pageToken)

  return users
}

export async function testGoogleConnection(config: GoogleWorkspaceConfig): Promise<TestResult> {
  try {
    const token = await getToken(config)
    const url = new URL("https://admin.googleapis.com/admin/directory/v1/users")
    url.searchParams.set("domain", config.domain)
    url.searchParams.set("maxResults", "1")
    url.searchParams.set("query", "isSuspended=false")

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Directory API error (${res.status})`)
    const data = await res.json()
    return { ok: true, userCount: data.users?.length ?? 0 }
  } catch (e: unknown) {
    return { ok: false, error: (e as Error).message }
  }
}
