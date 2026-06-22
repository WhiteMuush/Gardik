import { describe, it, expect, vi, beforeEach } from "vitest"

const employeeFindMany = vi.fn()
const userFindMany = vi.fn()
const breachUpsert = vi.fn()
const breachRecordCreate = vi.fn()
const alertCreate = vi.fn()
const emailEnabled = vi.fn()
const sendBreachAlert = vi.fn()
const loadActiveWebhooks = vi.fn()
const dispatchWebhooks = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    employee: { findMany: (a: unknown) => employeeFindMany(a) },
    user: { findMany: (a: unknown) => userFindMany(a) },
    breach: { upsert: (a: unknown) => breachUpsert(a) },
    breachRecord: { create: (a: unknown) => breachRecordCreate(a) },
    alert: { create: (a: unknown) => alertCreate(a) },
  },
}))
vi.mock("@/lib/directory/crypto", () => ({ decryptConfig: vi.fn() }))
vi.mock("@/lib/email", () => ({
  emailEnabled: () => emailEnabled(),
  sendBreachAlert: (...a: unknown[]) => sendBreachAlert(...a),
}))
vi.mock("@/lib/webhooks", () => ({
  loadActiveWebhooks: () => loadActiveWebhooks(),
  dispatchWebhooks: (...a: unknown[]) => dispatchWebhooks(...a),
}))
vi.mock("./registry", () => ({ providerById: vi.fn() }))
vi.mock("./normalize", () => ({ sleep: () => Promise.resolve() }))

import { runScan, severityFor } from "./runner"

describe("severityFor", () => {
  it("is CRITICAL with two or more critical data types", () => {
    expect(severityFor(["password", "ssn"])).toBe("CRITICAL")
    expect(severityFor(["password", "credit_card", "email"])).toBe("CRITICAL")
  })
  it("is HIGH with exactly one critical type", () => {
    expect(severityFor(["password", "email"])).toBe("HIGH")
  })
  it("is MEDIUM with no critical type", () => {
    expect(severityFor(["email", "username"])).toBe("MEDIUM")
    expect(severityFor([])).toBe("MEDIUM")
  })
  it("is CRITICAL when a session cookie or token leaks, whatever the data types", () => {
    expect(severityFor([], ["COOKIE"])).toBe("CRITICAL")
    expect(severityFor(["email"], ["TOKEN"])).toBe("CRITICAL")
  })
  it("ignores non-session artifacts for the override", () => {
    expect(severityFor(["email"], ["PASSWORD"])).toBe("MEDIUM")
    expect(severityFor(["password"], ["AUTOFILL"])).toBe("HIGH")
  })
})

function provider(lookup: ReturnType<typeof vi.fn>) {
  return { provider: { lookup, source: "HIBP", id: "hibp" }, key: "k" } as never
}

describe("runScan", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    emailEnabled.mockReturnValue(false)
    loadActiveWebhooks.mockResolvedValue([])
    breachRecordCreate.mockResolvedValue({})
    alertCreate.mockResolvedValue({})
  })

  it("persists a new finding and counts it", async () => {
    employeeFindMany.mockResolvedValue([
      { id: "e1", email: "e1@x.com", firstName: "E", lastName: "One", breachRecords: [] },
    ])
    breachUpsert.mockResolvedValue({ id: "b1" })
    const lookup = vi.fn().mockResolvedValue([
      { name: "Acme", breachDate: new Date(0), dataTypes: ["password"] },
    ])

    const res = await runScan("co1", [provider(lookup)])

    expect(res).toEqual({ scanned: 1, newRecords: 1, newAlerts: 1 })
    expect(breachRecordCreate).toHaveBeenCalledTimes(1)
    expect(alertCreate).toHaveBeenCalledTimes(1)
  })

  it("skips a breach the employee is already linked to", async () => {
    employeeFindMany.mockResolvedValue([
      { id: "e1", email: "e1@x.com", firstName: "E", lastName: "One", breachRecords: [{ breachId: "b1" }] },
    ])
    breachUpsert.mockResolvedValue({ id: "b1" })
    const lookup = vi.fn().mockResolvedValue([
      { name: "Acme", breachDate: new Date(0), dataTypes: ["password"] },
    ])

    const res = await runScan("co1", [provider(lookup)])

    expect(res.newRecords).toBe(0)
    expect(breachRecordCreate).not.toHaveBeenCalled()
  })

  it("isolates a provider error and keeps scanning", async () => {
    employeeFindMany.mockResolvedValue([
      { id: "e1", email: "e1@x.com", firstName: "E", lastName: "One", breachRecords: [] },
    ])
    const lookup = vi.fn().mockRejectedValue(new Error("rate limited"))

    const res = await runScan("co1", [provider(lookup)])

    expect(res).toEqual({ scanned: 1, newRecords: 0, newAlerts: 0 })
    expect(breachUpsert).not.toHaveBeenCalled()
  })
})
