import { describe, it, expect, vi, beforeEach } from "vitest"

const connFindMany = vi.fn()
const companyFindMany = vi.fn()
const companyUpdate = vi.fn()
const enqueueSyncJob = vi.fn()
const processSyncJobs = vi.fn()
const loadActiveProviders = vi.fn()
const runScan = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    directoryConnection: { findMany: (a: unknown) => connFindMany(a) },
    company: {
      findMany: (a: unknown) => companyFindMany(a),
      update: (a: unknown) => companyUpdate(a),
    },
  },
}))
vi.mock("./directory/jobs", () => ({
  enqueueSyncJob: (id: string) => enqueueSyncJob(id),
  processSyncJobs: () => processSyncJobs(),
}))
vi.mock("./scan/runner", () => ({
  loadActiveProviders: (id: string) => loadActiveProviders(id),
  runScan: (id: string, p: unknown) => runScan(id, p),
}))

import { isDue, runDueSchedules } from "./scheduler"

const NOW = new Date("2026-06-19T12:00:00Z")

describe("isDue", () => {
  it("is due when never run", () => {
    expect(isDue(null, 60, NOW)).toBe(true)
  })
  it("is due once the interval has elapsed", () => {
    expect(isDue(new Date("2026-06-19T11:00:00Z"), 60, NOW)).toBe(true)
  })
  it("is not due before the interval", () => {
    expect(isDue(new Date("2026-06-19T11:30:00Z"), 60, NOW)).toBe(false)
  })
})

describe("runDueSchedules", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    connFindMany.mockResolvedValue([])
    companyFindMany.mockResolvedValue([])
    processSyncJobs.mockResolvedValue({ processed: 0 })
    runScan.mockResolvedValue({ scanned: 0, newRecords: 0, newAlerts: 0 })
  })

  it("enqueues only connections whose interval has elapsed", async () => {
    connFindMany.mockResolvedValue([
      { id: "due", lastSyncAt: new Date("2026-06-19T10:00:00Z"), autoSyncIntervalMinutes: 60 },
      { id: "fresh", lastSyncAt: new Date("2026-06-19T11:59:00Z"), autoSyncIntervalMinutes: 60 },
    ])
    const res = await runDueSchedules(NOW)
    expect(enqueueSyncJob).toHaveBeenCalledTimes(1)
    expect(enqueueSyncJob).toHaveBeenCalledWith("due")
    expect(res.syncsEnqueued).toBe(1)
  })

  it("starts a due scan only when providers are configured", async () => {
    companyFindMany.mockResolvedValue([
      { id: "co-go", lastScanAt: null, scanIntervalMinutes: 60 },
      { id: "co-nokey", lastScanAt: null, scanIntervalMinutes: 60 },
    ])
    loadActiveProviders.mockImplementation((id: string) =>
      id === "co-go" ? Promise.resolve([{ provider: {}, key: "k" }]) : Promise.resolve([])
    )
    const res = await runDueSchedules(NOW)

    expect(companyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "co-go" }, data: { lastScanAt: NOW } })
    )
    expect(runScan).toHaveBeenCalledTimes(1)
    expect(res.scansStarted).toBe(1)
  })

  it("drains the sync queue and reports the count", async () => {
    processSyncJobs.mockResolvedValue({ processed: 4 })
    const res = await runDueSchedules(NOW)
    expect(processSyncJobs).toHaveBeenCalled()
    expect(res.jobsProcessed).toBe(4)
  })
})
