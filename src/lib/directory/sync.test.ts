import { describe, it, expect, vi, beforeEach } from "vitest"

const findFirst = vi.fn()
const update = vi.fn()
const upsert = vi.fn()
const fetchAzureUsers = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    directoryConnection: {
      findFirst: (a: unknown) => findFirst(a),
      update: (a: unknown) => update(a),
    },
    employee: { upsert: (a: unknown) => upsert(a) },
  },
}))
vi.mock("./crypto", () => ({ decryptConfig: () => ({}) }))
vi.mock("./azure", () => ({ fetchAzureUsers: () => fetchAzureUsers() }))
vi.mock("./google", () => ({ fetchGoogleUsers: vi.fn() }))
vi.mock("./ldap", () => ({ fetchLDAPUsers: vi.fn() }))
vi.mock("./aws", () => ({ fetchAWSUsers: vi.fn() }))
vi.mock("./okta", () => ({ fetchOktaUsers: vi.fn() }))

import { syncDirectoryConnection } from "./sync"

beforeEach(() => {
  vi.clearAllMocks()
  findFirst.mockResolvedValue({ id: "c1", type: "AZURE_AD", encryptedConfig: "enc" })
})

describe("syncDirectoryConnection", () => {
  it("throws when the connection is not found", async () => {
    findFirst.mockResolvedValue(null)
    await expect(syncDirectoryConnection("c1", "co1")).rejects.toThrow("Connection not found")
    expect(update).not.toHaveBeenCalled()
  })

  it("marks the connection ERROR and rethrows when the provider fails", async () => {
    fetchAzureUsers.mockRejectedValue(new Error("provider down"))
    await expect(syncDirectoryConnection("c1", "co1")).rejects.toThrow("provider down")
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1" },
        data: expect.objectContaining({ status: "ERROR", errorMessage: "provider down" }),
      })
    )
  })

  it("upserts each user, marks ACTIVE, and returns the synced count", async () => {
    fetchAzureUsers.mockResolvedValue([
      { email: "a@x.com", firstName: "A", lastName: "One" },
      { email: "b@x.com", firstName: "B", lastName: "Two" },
    ])
    const res = await syncDirectoryConnection("c1", "co1")

    expect(upsert).toHaveBeenCalledTimes(2)
    expect(res).toEqual({ synced: 2 })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1" },
        data: expect.objectContaining({ status: "ACTIVE", lastSyncCount: 2, errorMessage: null }),
      })
    )
  })
})
