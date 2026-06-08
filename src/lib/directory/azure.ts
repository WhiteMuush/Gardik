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

export async function fetchAzureUsers(config: AzureADConfig): Promise<DirectoryUser[]> {
  const token = await getToken(config)
  const users: DirectoryUser[] = []

  let url: string | null =
    "https://graph.microsoft.com/v1.0/users" +
    "?$select=givenName,surname,mail,department" +
    "&$top=999" +
    "&$filter=accountEnabled eq true"

  while (url) {
    const graphRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!graphRes.ok) throw new Error(`Graph API error (${graphRes.status})`)
    const data = (await graphRes.json()) as { value: Record<string, unknown>[]; "@odata.nextLink"?: string }

    for (const u of data.value ?? []) {
      if (!u.mail) continue
      users.push({
        email: (u.mail as string).toLowerCase(),
        firstName: (u.givenName as string) ?? "",
        lastName: (u.surname as string) ?? "",
        department: (u.department as string) ?? undefined,
      })
    }
    url = data["@odata.nextLink"] ?? null
  }

  return users
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
