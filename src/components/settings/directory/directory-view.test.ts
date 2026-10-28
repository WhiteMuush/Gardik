import { describe, expect, it } from "vitest"
import type { Connection } from "./meta"
import { buildDirectoryViews, directoryStatus, matchesDirectory } from "./directory-view"

function conn(over: Partial<Connection>): Connection {
  return {
    id: "c1",
    type: "OKTA",
    name: "Okta prod",
    status: "ACTIVE",
    lastSyncAt: null,
    lastSyncCount: null,
    errorMessage: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    ...over,
  }
}

describe("directoryStatus", () => {
  it("is NOT_CONNECTED without connections", () => {
    expect(directoryStatus([])).toBe("NOT_CONNECTED")
  })

  it("reports an error before anything else", () => {
    expect(directoryStatus([conn({ status: "ACTIVE" }), conn({ status: "ERROR" })])).toBe("ERROR")
  })

  it("prefers ACTIVE over PENDING", () => {
    expect(directoryStatus([conn({ status: "PENDING" }), conn({ status: "ACTIVE" })])).toBe("ACTIVE")
    expect(directoryStatus([conn({ status: "PENDING" })])).toBe("PENDING")
  })
})

describe("buildDirectoryViews", () => {
  it("returns one view per directory type, with its own connections", () => {
    const views = buildDirectoryViews([conn({ type: "OKTA" }), conn({ id: "c2", type: "LDAP" })])
    expect(views).toHaveLength(6)
    expect(views.find((v) => v.provider.type === "OKTA")?.connections).toHaveLength(1)
    expect(views.find((v) => v.provider.type === "SCIM")?.status).toBe("NOT_CONNECTED")
  })
})

describe("matchesDirectory", () => {
  const [azure, google] = buildDirectoryViews([conn({ type: "AZURE_AD", status: "ERROR" })])

  it("filters by connection and error state", () => {
    expect(matchesDirectory(azure!, "Connected", "")).toBe(true)
    expect(matchesDirectory(azure!, "Needs action", "")).toBe(true)
    expect(matchesDirectory(google!, "Connected", "")).toBe(false)
    expect(matchesDirectory(google!, "Not connected", "")).toBe(true)
  })

  it("searches label and description, ignoring case", () => {
    expect(matchesDirectory(google!, "All", "gmail")).toBe(true)
    expect(matchesDirectory(google!, "All", "okta")).toBe(false)
  })
})
