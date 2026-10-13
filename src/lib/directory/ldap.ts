import type { LDAPConfig, DirectoryUser, TestResult } from "./types"

// LDAP requires the `ldapts` package: npm install ldapts
// Falls back to a clear runtime error if not installed.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getLdapts(): Promise<any> {
  try {
    return await import("ldapts")
  } catch {
    throw new Error('LDAP connector requires the "ldapts" package. Run: npm install ldapts')
  }
}

// Multi-valued attributes (several mail values in OpenLDAP) come back as arrays.
function first(value: unknown): string | undefined {
  const v = Array.isArray(value) ? value[0] : value
  return v == null ? undefined : String(v)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function connect(config: LDAPConfig, timeout: number): Promise<any> {
  const { Client } = await getLdapts()
  const client = new Client({
    url: `${config.ssl ? "ldaps" : "ldap"}://${config.host}:${config.port}`,
    timeout,
    connectTimeout: timeout,
    tlsOptions: config.ssl ? { rejectUnauthorized: true } : undefined,
  })
  await client.bind(config.bindDN, config.bindPassword)
  return client
}

export async function fetchLDAPUsers(config: LDAPConfig): Promise<DirectoryUser[]> {
  const client = await connect(config, 10000)
  try {
    const { searchEntries } = await client.search(config.baseDN, {
      scope: "sub",
      filter: config.userFilter || "(objectClass=person)",
      attributes: ["mail", "givenName", "sn", "department"],
      paged: true,
    })
    return (searchEntries as Record<string, unknown>[])
      .filter((e) => first(e.mail))
      .map((e) => ({
        email: first(e.mail)!.toLowerCase(),
        firstName: first(e.givenName) ?? "",
        lastName: first(e.sn) ?? "",
        department: first(e.department),
      }))
  } finally {
    await client.unbind()
  }
}

export async function testLDAPConnection(config: LDAPConfig): Promise<TestResult> {
  try {
    const client = await connect(config, 8000)
    try {
      const { searchEntries } = await client.search(config.baseDN, {
        scope: "sub",
        filter: config.userFilter || "(objectClass=person)",
        attributes: ["mail"],
        paged: { pageSize: 1 },
      })
      return { ok: true, userCount: searchEntries.length }
    } finally {
      await client.unbind()
    }
  } catch (e: unknown) {
    return { ok: false, error: (e as Error).message }
  }
}
