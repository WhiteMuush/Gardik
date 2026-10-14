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
const scanCheckUpsert = vi.fn()

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
    scanCheck: { upsert: (a: unknown) => scanCheckUpsert(a) },
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

import { runScan } from "./runner"
import { emptyEmployee, provider } from "./runner.fixtures"

describe("runScan", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    emailEnabled.mockReturnValue(false)
    loadActiveWebhooks.mockResolvedValue([])
    breachRecordCreate.mockResolvedValue({ id: "r1" })
    breachRecordUpdate.mockResolvedValue({})
    alertCreate.mockResolvedValue({ id: "a1" })
    alertUpdate.mockResolvedValue({})
    scanCheckUpsert.mockResolvedValue({})
  })

  it("persists a new finding and counts it", async () => {
    employeeFindMany.mockResolvedValue([emptyEmployee()])
    breachUpsert.mockResolvedValue({ id: "b1" })
    const lookup = vi
      .fn()
      .mockResolvedValue([{ name: "Acme", breachDate: new Date(0), dataTypes: ["password"] }])

    const res = await runScan("co1", [provider(lookup)])

    expect(res).toEqual({ scanned: 1, newRecords: 1, newAlerts: 1, failedChecks: 0 })
    expect(breachRecordCreate).toHaveBeenCalledTimes(1)
    expect(alertCreate).toHaveBeenCalledTimes(1)
  })

  it("corroborates instead of duplicating when a second tool reports the same breach", async () => {
    employeeFindMany.mockResolvedValue([emptyEmployee()])
    breachUpsert.mockResolvedValue({ id: "b1" })
    const hibp = vi
      .fn()
      .mockResolvedValue([{ name: "LinkedIn", breachDate: new Date(0), dataTypes: ["email"] }])
    // Same breach, different label and a richer data type, from another tool.
    const dehashed = vi
      .fn()
      .mockResolvedValue([{ name: "LinkedIn.com", breachDate: new Date(0), dataTypes: ["password"] }])

    const res = await runScan("co1", [
      provider(hibp, "HIBP", "HIBP"),
      provider(dehashed, "DEHASHED", "DARK_WEB"),
    ])

    // One record/alert created, the second hit merged onto it.
    expect(res).toEqual({ scanned: 1, newRecords: 1, newAlerts: 1, failedChecks: 0 })
    expect(breachRecordCreate).toHaveBeenCalledTimes(1)
    expect(alertCreate).toHaveBeenCalledTimes(1)
    expect(breachRecordUpdate).toHaveBeenCalledTimes(1)
    expect(alertUpdate).toHaveBeenCalledTimes(1)

    const recordMerge = breachRecordUpdate.mock.calls[0]![0].data
    expect(recordMerge.exposedData.sort()).toEqual(["email", "password"])
    expect(recordMerge.sources).toEqual(["HIBP", "DEHASHED"])
    // Two tools confirm: the merged password makes it HIGH, and the second tool lifts the confidence.
    const alertMerge = alertUpdate.mock.calls[0]![0].data
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
        scanChecks: [],
      },
    ])
    const dehashed = vi
      .fn()
      .mockResolvedValue([{ name: "linkedin", breachDate: new Date(0), dataTypes: ["password"] }])

    const res = await runScan("co1", [provider(dehashed, "DEHASHED", "DARK_WEB")])

    expect(res.newRecords).toBe(0)
    expect(breachRecordCreate).not.toHaveBeenCalled()
    expect(breachRecordUpdate).toHaveBeenCalledTimes(1)
    expect(alertUpdate).toHaveBeenCalledTimes(1)
  })
})
