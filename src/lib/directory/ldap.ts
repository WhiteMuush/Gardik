import type { LDAPConfig, DirectoryUser, TestResult } from "./types"

// LDAP requires the `ldapts` package: npm install ldapts
// Falls back to a clear runtime error if not installed.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getLdapts(): Promise<any> {
  try {
    return await import("ldapts")
  } catch {
    throw new Error(
      'LDAP connector requires the "ldapts" package. Run: npm install ldapts'
    )
  }
}

export async function fetchLDAPUsers(config: LDAPConfig): Promise<DirectoryUser[]> {
  const { Client } = await getLdapts()

  const client = new Client({
    url: `${config.ssl ? "ldaps" : "ldap"}://${config.host}:${config.port}`,
    timeout: 10000,
    connectTimeout: 10000,
    tlsOptions: config.ssl ? { rejectUnauthorized: true } : undefined,
  })

  await client.bind(config.bindDN, config.bindPassword)

  const { searchEntries } = await client.search(config.baseDN, {
    scope: "sub",
    filter: config.userFilter || "(objectClass=person)",
    attributes: ["mail", "givenName", "sn", "department"],
    paged: true,
  })

  await client.unbind()

  return (searchEntries as Record<string, unknown>[])
    .filter((e) => Boolean(e.mail))
    .map((e) => ({
      email: String(e.mail).toLowerCase(),
      firstName: (e.givenName as string) ?? "",
      lastName: (e.sn as string) ?? "",
      department: (e.department as string) ?? undefined,
    }))
}

export async function testLDAPConnection(config: LDAPConfig): Promise<TestResult> {
  try {
    const { Client } = await getLdapts()
    const client = new Client({
      url: `${config.ssl ? "ldaps" : "ldap"}://${config.host}:${config.port}`,
      timeout: 8000,
      connectTimeout: 8000,
    })
    await client.bind(config.bindDN, config.bindPassword)
    const { searchEntries } = await client.search(config.baseDN, {
      scope: "sub",
      filter: config.userFilter || "(objectClass=person)",
      attributes: ["mail"],
      paged: { pageSize: 1 },
    })
    await client.unbind()
    return { ok: true, userCount: searchEntries.length }
  } catch (e: unknown) {
    return { ok: false, error: (e as Error).message }
  }
}
