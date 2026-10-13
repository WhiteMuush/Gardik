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
import { ProviderError } from "./errors"
import { emptyEmployee, provider } from "./runner.fixtures"

function checkWrites() {
  return scanCheckUpsert.mock.calls.map(([a]) => ({
    employeeId: a.where.employeeId_provider.employeeId,
    provider: a.where.employeeId_provider.provider,
    status: a.create.status,
    failureReason: a.create.failureReason,
    checked: a.create.lastCheckedAt instanceof Date,
  }))
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
    scanCheckUpsert.mockResolvedValue({})
  })

  it("isolates a provider error and keeps scanning the other sources", async () => {
    employeeFindMany.mockResolvedValue([emptyEmployee()])
    const broken = vi.fn().mockRejectedValue(new Error("boom"))
    const healthy = vi.fn().mockResolvedValue([])

    const res = await runScan("co1", [provider(broken), provider(healthy, "DEHASHED", "DARK_WEB")])

    expect(res).toEqual({ scanned: 1, newRecords: 0, newAlerts: 0, failedChecks: 1 })
    expect(healthy).toHaveBeenCalledTimes(1)
    expect(breachUpsert).not.toHaveBeenCalled()
  })

  it("records a successful lookup as checked", async () => {
    employeeFindMany.mockResolvedValue([emptyEmployee()])

    await runScan("co1", [provider(vi.fn().mockResolvedValue([]))])

    expect(checkWrites()).toEqual([
      { employeeId: "e1", provider: "HIBP", status: "CHECKED", failureReason: null, checked: true },
    ])
  })

  it("records a failed lookup as failed, never as clean", async () => {
    employeeFindMany.mockResolvedValue([emptyEmployee()])
    const lookup = vi.fn().mockRejectedValue(new ProviderError("HIBP error 401", 401))

    const res = await runScan("co1", [provider(lookup)])

    expect(res.failedChecks).toBe(1)
    expect(lookup).toHaveBeenCalledTimes(1)
    expect(checkWrites()).toEqual([
      {
        employeeId: "e1",
        provider: "HIBP",
        status: "FAILED",
        failureReason: "API key rejected",
        checked: false,
      },
    ])
    expect(scanCheckUpsert.mock.calls[0][0].update).not.toHaveProperty("lastCheckedAt")
  })

  it("retries a rate-limited lookup, then records it as checked", async () => {
    employeeFindMany.mockResolvedValue([emptyEmployee()])
    const lookup = vi
      .fn()
      .mockRejectedValueOnce(new ProviderError("HIBP error 429", 429, 1000))
      .mockResolvedValueOnce([])

    const res = await runScan("co1", [provider(lookup)])

    expect(lookup).toHaveBeenCalledTimes(2)
    expect(res.failedChecks).toBe(0)
    expect(checkWrites()[0].status).toBe("CHECKED")
  })

  it("gives up after the retry budget and says why", async () => {
    employeeFindMany.mockResolvedValue([emptyEmployee()])
    const lookup = vi.fn().mockRejectedValue(new ProviderError("HIBP error 429", 429, 1000))

    const res = await runScan("co1", [provider(lookup)])

    expect(lookup).toHaveBeenCalledTimes(4)
    expect(res.failedChecks).toBe(1)
    expect(checkWrites()[0]).toMatchObject({ status: "FAILED", failureReason: "Rate limited by the source" })
  })

  it("stops calling a source whose key is rejected, and marks the rest as failed", async () => {
    employeeFindMany.mockResolvedValue([emptyEmployee("e1"), emptyEmployee("e2")])
    const lookup = vi.fn().mockRejectedValue(new ProviderError("HIBP error 401", 401))

    const res = await runScan("co1", [provider(lookup)])

    expect(lookup).toHaveBeenCalledTimes(1)
    expect(res.failedChecks).toBe(2)
    expect(checkWrites().map((c) => [c.employeeId, c.status, c.failureReason])).toEqual([
      ["e1", "FAILED", "API key rejected"],
      ["e2", "FAILED", "API key rejected"],
    ])
  })

  it("fails at once when the source asks to wait longer than a scan can", async () => {
    employeeFindMany.mockResolvedValue([emptyEmployee("e1"), emptyEmployee("e2")])
    const lookup = vi.fn().mockRejectedValue(new ProviderError("LeakCheck error 429", 429, 3_600_000))

    const res = await runScan("co1", [provider(lookup, "LEAKCHECK", "DARK_WEB")])

    expect(lookup).toHaveBeenCalledTimes(1)
    expect(res.failedChecks).toBe(2)
    expect(checkWrites()[1]).toMatchObject({ provider: "LEAKCHECK", status: "FAILED" })
  })

  it("only rescans failed or never checked pairs when asked", async () => {
    employeeFindMany.mockResolvedValue([
      emptyEmployee("e1", [
        { provider: "HIBP", status: "CHECKED" },
        { provider: "DEHASHED", status: "FAILED" },
      ]),
      emptyEmployee("e2", [
        { provider: "HIBP", status: "CHECKED" },
        { provider: "DEHASHED", status: "CHECKED" },
      ]),
    ])
    const hibp = vi.fn().mockResolvedValue([])
    const dehashed = vi.fn().mockResolvedValue([])

    const res = await runScan("co1", [provider(hibp), provider(dehashed, "DEHASHED", "DARK_WEB")], {
      onlyIncomplete: true,
    })

    expect(hibp).not.toHaveBeenCalled()
    expect(dehashed).toHaveBeenCalledTimes(1)
    expect(dehashed).toHaveBeenCalledWith("e1@x.com", "k")
    expect(res.scanned).toBe(1)
  })
})
