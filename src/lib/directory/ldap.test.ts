import { describe, it, expect, vi, beforeEach } from "vitest"

const ldap = vi.hoisted(() => ({
  options: [] as Record<string, unknown>[],
  bind: vi.fn(),
  search: vi.fn(),
  unbind: vi.fn(),
}))

vi.mock("ldapts", () => ({
  Client: class {
    constructor(options: Record<string, unknown>) {
      ldap.options.push(options)
    }
    bind = ldap.bind
    search = ldap.search
    unbind = ldap.unbind
  },
}))

import { fetchLDAPUsers, testLDAPConnection } from "./ldap"

const config = {
  host: "dc.x.com",
  port: 636,
  ssl: true,
  bindDN: "cn=svc,dc=x,dc=com",
  bindPassword: "pw",
  baseDN: "ou=people,dc=x,dc=com",
  userFilter: "",
}

beforeEach(() => {
  ldap.options.length = 0
  ldap.bind.mockReset().mockResolvedValue(undefined)
  ldap.search.mockReset().mockResolvedValue({ searchEntries: [] })
  ldap.unbind.mockReset().mockResolvedValue(undefined)
})

describe("fetchLDAPUsers", () => {
  it("connects over LDAPS with certificate checks and binds as the service account", async () => {
    await fetchLDAPUsers(config)
    expect(ldap.options[0]).toMatchObject({
      url: "ldaps://dc.x.com:636",
      tlsOptions: { rejectUnauthorized: true },
    })
    expect(ldap.bind).toHaveBeenCalledWith("cn=svc,dc=x,dc=com", "pw")
  })

  it("uses plain LDAP when SSL is off", async () => {
    await fetchLDAPUsers({ ...config, ssl: false, port: 389 })
    expect(ldap.options[0].url).toBe("ldap://dc.x.com:389")
  })

  it("searches persons by default, or the configured filter", async () => {
    await fetchLDAPUsers(config)
    await fetchLDAPUsers({ ...config, userFilter: "(memberOf=cn=staff)" })
    expect(ldap.search.mock.calls[0]).toEqual([
      "ou=people,dc=x,dc=com",
      expect.objectContaining({ filter: "(objectClass=person)", paged: true }),
    ])
    expect(ldap.search.mock.calls[1][1].filter).toBe("(memberOf=cn=staff)")
  })

  it("maps entries, lowercases emails and skips entries without mail", async () => {
    ldap.search.mockResolvedValue({
      searchEntries: [
        { dn: "a", mail: "A@X.com", givenName: "Ada", sn: "Lovelace", department: "R&D" },
        { dn: "b", givenName: "No", sn: "Mail" },
      ],
    })

    expect(await fetchLDAPUsers(config)).toEqual([
      { email: "a@x.com", firstName: "Ada", lastName: "Lovelace", department: "R&D" },
    ])
  })

  it("keeps the first value of multi-valued attributes", async () => {
    ldap.search.mockResolvedValue({
      searchEntries: [{ dn: "a", mail: ["a@x.com", "alias@x.com"], givenName: ["Ada"], sn: "Lovelace" }],
    })

    const [user] = await fetchLDAPUsers(config)
    expect(user.email).toBe("a@x.com")
    expect(user.firstName).toBe("Ada")
  })

  it("closes the connection when the search fails", async () => {
    ldap.search.mockRejectedValue(new Error("Size limit exceeded"))
    await expect(fetchLDAPUsers(config)).rejects.toThrow("Size limit exceeded")
    expect(ldap.unbind).toHaveBeenCalled()
  })
})

describe("testLDAPConnection", () => {
  it("returns the bind error instead of throwing", async () => {
    ldap.bind.mockRejectedValue(new Error("Invalid credentials"))
    expect(await testLDAPConnection(config)).toEqual({ ok: false, error: "Invalid credentials" })
  })

  it("checks certificates like the sync does", async () => {
    await testLDAPConnection(config)
    expect(ldap.options[0]).toMatchObject({ tlsOptions: { rejectUnauthorized: true } })
  })
})
