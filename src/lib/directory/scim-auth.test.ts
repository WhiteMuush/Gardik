import { describe, it, expect, vi, beforeEach } from "vitest"

const findFirst = vi.fn()
const decryptConfig = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: { directoryConnection: { findFirst: (a: unknown) => findFirst(a) } },
}))
vi.mock("@/lib/directory/crypto", () => ({
  decryptConfig: (s: string) => decryptConfig(s),
}))

import { authenticateScim, checkScimRateLimit } from "./scim-auth"

function reqWith(token?: string): Request {
  const headers = new Headers()
  if (token !== undefined) headers.set("authorization", token)
  return new Request("http://localhost/api/scim/c1/Users", { headers })
}

beforeEach(() => vi.clearAllMocks())

describe("authenticateScim", () => {
  it("rejects a missing or malformed token without a DB hit", async () => {
    expect(await authenticateScim(reqWith(), "c1")).toBeNull()
    expect(await authenticateScim(reqWith("Bearer   "), "c1")).toBeNull()
    expect(findFirst).not.toHaveBeenCalled()
  })

  it("rejects an unknown connection", async () => {
    findFirst.mockResolvedValue(null)
    expect(await authenticateScim(reqWith("Bearer tok"), "c1")).toBeNull()
  })

  it("returns the companyId on a matching token", async () => {
    findFirst.mockResolvedValue({ encryptedConfig: "enc", companyId: "co1" })
    decryptConfig.mockReturnValue({ bearerToken: "tok" })
    expect(await authenticateScim(reqWith("Bearer tok"), "c1")).toEqual({ companyId: "co1" })
  })

  it("rejects a wrong token", async () => {
    findFirst.mockResolvedValue({ encryptedConfig: "enc", companyId: "co1" })
    decryptConfig.mockReturnValue({ bearerToken: "right" })
    expect(await authenticateScim(reqWith("Bearer wrong"), "c1")).toBeNull()
  })

  it("returns null (not throw) on unreadable config", async () => {
    findFirst.mockResolvedValue({ encryptedConfig: "enc", companyId: "co1" })
    decryptConfig.mockImplementation(() => {
      throw new Error("bad")
    })
    expect(await authenticateScim(reqWith("Bearer tok"), "c1")).toBeNull()
  })

  it("scopes the lookup to SCIM connections by id", async () => {
    findFirst.mockResolvedValue(null)
    await authenticateScim(reqWith("Bearer tok"), "c1")
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "c1", type: "SCIM" } })
    )
  })
})

describe("checkScimRateLimit", () => {
  it("allows up to 120 requests per connection then throttles", () => {
    const id = `conn-${Math.random()}`
    for (let i = 0; i < 120; i++) expect(checkScimRateLimit(id)).toBe(true)
    expect(checkScimRateLimit(id)).toBe(false)
  })

  it("tracks connections independently", () => {
    const a = `a-${Math.random()}`
    const b = `b-${Math.random()}`
    for (let i = 0; i < 120; i++) checkScimRateLimit(a)
    expect(checkScimRateLimit(a)).toBe(false)
    expect(checkScimRateLimit(b)).toBe(true)
  })
})
