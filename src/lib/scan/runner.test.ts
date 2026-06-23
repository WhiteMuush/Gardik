import { describe, it, expect, vi, beforeEach } from "vitest"

const employeeFindMany = vi.fn()
const userFindMany = vi.fn()
const breachUpsert = vi.fn()
const breachRecordCreate = vi.fn()
const breachRecordUpdate = vi.fn()
const alertCreate = vi.fn()
const alertUpdate = vi.fn()
const emailEnabled = vi.fn()
const sendBreachAlert = vi.fn()
const loadActiveWebhooks = vi.fn()
const dispatchWebhooks = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    employee: { findMany: (a: unknown) => employeeFindMany(a) },
    user: { findMany: (a: unknown) => userFindMany(a) },
    breach: { upsert: (a: unknown) => breachUpsert(a) },
    breachRecord: {
      create: (a: unknown) => breachRecordCreate(a),
      update: (a: unknown) => breachRecordUpdate(a),
    },
    alert: { create: (a: unknown) => alertCreate(a), update: (a: unknown) => alertUpdate(a) },
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
vi.mock("./normalize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./normalize")>()),
  sleep: () => Promise.resolve(),
}))

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
  it("is CRITICAL when a session cookie or token leaks, whatever the source", () => {
    expect(severityFor([], ["COOKIE"])).toBe("CRITICAL")
    expect(severityFor(["email"], ["TOKEN"])).toBe("CRITICAL")
    expect(severityFor([], ["COOKIE"], "STEALER_LOG")).toBe("CRITICAL")
    expect(severityFor([], ["TOKEN"], "DARK_WEB")).toBe("CRITICAL")
  })
  it("ignores non-session artifacts for the override on breach dumps", () => {
    expect(severityFor(["email"], ["PASSWORD"])).toBe("MEDIUM")
    expect(severityFor(["password"], ["AUTOFILL"])).toBe("HIGH")
  })
  it("never rates a stealer log below HIGH (active endpoint infection)", () => {
    expect(severityFor([], [], "STEALER_LOG")).toBe("HIGH")
    expect(severityFor(["email"], [], "STEALER_LOG")).toBe("HIGH")
    expect(severityFor(["email"], ["AUTOFILL"], "STEALER_LOG")).toBe("HIGH")
  })
  it("is CRITICAL for a stealer log with stolen credentials", () => {
    expect(severityFor(["email"], ["PASSWORD"], "STEALER_LOG")).toBe("CRITICAL")
    expect(severityFor(["password"], [], "STEALER_LOG")).toBe("CRITICAL")
  })
  it("applies data-type logic to dark-web and curated dumps alike", () => {
    expect(severityFor([], [], "DARK_WEB")).toBe("MEDIUM")
    expect(severityFor(["password"], [], "DARK_WEB")).toBe("HIGH")
    expect(severityFor(["password", "ssn"], [], "DARK_WEB")).toBe("CRITICAL")
    expect(severityFor(["password"], [], "HIBP")).toBe("HIGH")
  })
})

function provider(
  lookup: ReturnType<typeof vi.fn>,
  id = "HIBP",
  source = "HIBP"
) {
  return { provider: { lookup, source, id }, key: "k" } as never
}

function emptyEmployee() {
  return { id: "e1", email: "e1@x.com", firstName: "E", lastName: "One", breachRecords: [], alerts: [] }
}

describe("runScan", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    emailEnabled.mockReturnValue(false)
    loadActiveWebhooks.mockResolvedValue([])
    breachRecordCreate.mockResolvedValue({ id: "r1" })
    breachRecordUpdate.mockResolvedValue({})
    alertCreate.mockResolvedValue({ id: "a1" })
    alertUpdate.mockResolvedValue({})
  })

  it("persists a new finding and counts it", async () => {
    employeeFindMany.mockResolvedValue([emptyEmployee()])
    breachUpsert.mockResolvedValue({ id: "b1" })
    const lookup = vi.fn().mockResolvedValue([
      { name: "Acme", breachDate: new Date(0), dataTypes: ["password"] },
    ])

    const res = await runScan("co1", [provider(lookup)])

    expect(res).toEqual({ scanned: 1, newRecords: 1, newAlerts: 1 })
    expect(breachRecordCreate).toHaveBeenCalledTimes(1)
    expect(alertCreate).toHaveBeenCalledTimes(1)
  })

  it("corroborates instead of duplicating when a second tool reports the same breach", async () => {
    employeeFindMany.mockResolvedValue([emptyEmployee()])
    breachUpsert.mockResolvedValue({ id: "b1" })
    const hibp = vi.fn().mockResolvedValue([
      { name: "LinkedIn", breachDate: new Date(0), dataTypes: ["email"] },
    ])
    // Same breach, different label and a richer data type, from another tool.
    const dehashed = vi.fn().mockResolvedValue([
      { name: "LinkedIn.com", breachDate: new Date(0), dataTypes: ["password"] },
    ])

    const res = await runScan("co1", [
      provider(hibp, "HIBP", "HIBP"),
      provider(dehashed, "DEHASHED", "DARK_WEB"),
    ])

    // One record/alert created, the second hit merged onto it.
    expect(res).toEqual({ scanned: 1, newRecords: 1, newAlerts: 1 })
    expect(breachRecordCreate).toHaveBeenCalledTimes(1)
    expect(alertCreate).toHaveBeenCalledTimes(1)
    expect(breachRecordUpdate).toHaveBeenCalledTimes(1)
    expect(alertUpdate).toHaveBeenCalledTimes(1)

    const recordMerge = breachRecordUpdate.mock.calls[0][0].data
    expect(recordMerge.exposedData.sort()).toEqual(["email", "password"])
    expect(recordMerge.sources).toEqual(["HIBP", "DEHASHED"])
    // Two independent tools confirm: HIBP severity HIGH (password merged), and
    // confidence is lifted (HIGH source corroborated by a second tool).
    const alertMerge = alertUpdate.mock.calls[0][0].data
    expect(alertMerge.severity).toBe("HIGH")
    expect(alertMerge.confidence).toBe("HIGH")
  })

  it("does not corroborate twice for the same provider", async () => {
    employeeFindMany.mockResolvedValue([emptyEmployee()])
    breachUpsert.mockResolvedValue({ id: "b1" })
    const lookup = vi.fn().mockResolvedValue([
      { name: "Acme", breachDate: new Date(0), dataTypes: ["password"] },
      { name: "acme", breachDate: new Date(0), dataTypes: ["email"] },
    ])

    const res = await runScan("co1", [provider(lookup)])

    expect(res.newRecords).toBe(1)
    expect(breachRecordCreate).toHaveBeenCalledTimes(1)
    expect(breachRecordUpdate).not.toHaveBeenCalled()
  })

  it("dedups against a breach from an earlier scan", async () => {
    employeeFindMany.mockResolvedValue([
      {
        id: "e1",
        email: "e1@x.com",
        firstName: "E",
        lastName: "One",
        breachRecords: [
          {
            id: "r1",
            breachId: "b1",
            exposedData: ["email"],
            artifacts: [],
            sources: ["HIBP"],
            breach: { name: "LinkedIn", source: "HIBP" },
          },
        ],
        alerts: [{ id: "a1", breachId: "b1", severity: "MEDIUM", confidence: "HIGH" }],
      },
    ])
    const dehashed = vi.fn().mockResolvedValue([
      { name: "linkedin", breachDate: new Date(0), dataTypes: ["password"] },
    ])

    const res = await runScan("co1", [provider(dehashed, "DEHASHED", "DARK_WEB")])

    expect(res.newRecords).toBe(0)
    expect(breachRecordCreate).not.toHaveBeenCalled()
    expect(breachRecordUpdate).toHaveBeenCalledTimes(1)
    expect(alertUpdate).toHaveBeenCalledTimes(1)
  })

  it("isolates a provider error and keeps scanning", async () => {
    employeeFindMany.mockResolvedValue([emptyEmployee()])
    const lookup = vi.fn().mockRejectedValue(new Error("rate limited"))

    const res = await runScan("co1", [provider(lookup)])

    expect(res).toEqual({ scanned: 1, newRecords: 0, newAlerts: 0 })
    expect(breachUpsert).not.toHaveBeenCalled()
  })
})
