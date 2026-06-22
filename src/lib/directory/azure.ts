import type { AzureADConfig, DirectoryUser, TestResult } from "./types"

async function getToken(config: AzureADConfig): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: "https://graph.microsoft.com/.default",
      }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error_description ?? `Azure auth failed (${res.status})`)
  }
  const data = await res.json()
  return data.access_token as string
}

// MFA registration state keyed by lower-cased userPrincipalName. Read from the
// authentication-methods report; returns an empty map (MFA stays unknown) if the
// app lacks the report permission, so a sync never fails over missing MFA data.
async function fetchMfaByUpn(token: string): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>()
  let url: string | null =
    "https://graph.microsoft.com/v1.0/reports/authenticationMethods/userRegistrationDetails" +
    "?$select=userPrincipalName,isMfaRegistered"
  try {
    while (url) {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return map
      const data = (await res.json()) as {
        value?: { userPrincipalName?: string; isMfaRegistered?: boolean }[]
        "@odata.nextLink"?: string
      }
      for (const r of data.value ?? []) {
        if (r.userPrincipalName && typeof r.isMfaRegistered === "boolean")
          map.set(r.userPrincipalName.toLowerCase(), r.isMfaRegistered)
      }
      url = data["@odata.nextLink"] ?? null
    }
  } catch {
    return map
  }
  return map
}

export async function fetchAzureUsers(config: AzureADConfig): Promise<DirectoryUser[]> {
  const token = await getToken(config)
  const users: DirectoryUser[] = []
  const mfaByUpn = await fetchMfaByUpn(token)

  let url: string | null =
    "https://graph.microsoft.com/v1.0/users" +
    "?$select=givenName,surname,mail,department,userPrincipalName" +
    "&$top=999" +
    "&$filter=accountEnabled eq true"

  while (url) {
    const graphRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!graphRes.ok) throw new Error(`Graph API error (${graphRes.status})`)
    const data = (await graphRes.json()) as { value: Record<string, unknown>[]; "@odata.nextLink"?: string }

    for (const u of data.value ?? []) {
      if (!u.mail) continue
      const upn = (u.userPrincipalName as string | undefined)?.toLowerCase()
      users.push({
        email: (u.mail as string).toLowerCase(),
        firstName: (u.givenName as string) ?? "",
        lastName: (u.surname as string) ?? "",
        department: (u.department as string) ?? undefined,
        mfaEnabled: upn ? mfaByUpn.get(upn) : undefined,
      })
    }
    url = data["@odata.nextLink"] ?? null
  }

  return users
}

// Revoke a user's refresh tokens, invalidating their active sessions. The user
// key accepts the userPrincipalName/email. Requires User.ReadWrite.All.
export async function revokeAzureSessions(config: AzureADConfig, email: string): Promise<void> {
  const token = await getToken(config)
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/revokeSignInSessions`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error(`Graph revokeSignInSessions failed (${res.status})`)
}

export async function testAzureConnection(config: AzureADConfig): Promise<TestResult> {
  try {
    const token = await getToken(config)

    const countRes = await fetch(
      "https://graph.microsoft.com/v1.0/users/$count?$filter=accountEnabled eq true",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ConsistencyLevel: "eventual",
        },
      }
    )

    const userCount = countRes.ok ? parseInt(await countRes.text(), 10) : undefined
    return { ok: true, userCount }
  } catch (e: unknown) {
    return { ok: false, error: (e as Error).message }
  }
}
