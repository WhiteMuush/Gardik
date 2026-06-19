import { describe, it, expect, vi, beforeEach } from "vitest"

const syncJobFindFirst = vi.fn()
const syncJobCreate = vi.fn()
const syncJobUpdate = vi.fn()
const connFindUnique = vi.fn()
const queryRaw = vi.fn()
const syncDirectoryConnection = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    syncJob: {
      findFirst: (a: unknown) => syncJobFindFirst(a),
      create: (a: unknown) => syncJobCreate(a),
      update: (a: unknown) => syncJobUpdate(a),
    },
    directoryConnection: { findUnique: (a: unknown) => connFindUnique(a) },
    $queryRaw: () => queryRaw(),
  },
}))
vi.mock("./sync", () => ({
  syncDirectoryConnection: (id: string, companyId: string) =>
    syncDirectoryConnection(id, companyId),
}))

import { backoffMs, enqueueSyncJob, processSyncJobs } from "./jobs"

beforeEach(() => {
  vi.clearAllMocks()
  connFindUnique.mockResolvedValue({ companyId: "co-1" })
})

describe("backoffMs", () => {
  it("grows exponentially from 30s", () => {
    expect(backoffMs(1)).toBe(30_000)
    expect(backoffMs(2)).toBe(60_000)
    expect(backoffMs(3)).toBe(120_000)
  })
})

describe("enqueueSyncJob", () => {
  it("reuses an existing pending/running job", async () => {
    syncJobFindFirst.mockResolvedValue({ id: "job-1", status: "PENDING" })
    const res = await enqueueSyncJob("c1")
    expect(res).toEqual({ id: "job-1", status: "PENDING" })
    expect(syncJobCreate).not.toHaveBeenCalled()
  })

  it("creates a job when none is active", async () => {
    syncJobFindFirst.mockResolvedValue(null)
    syncJobCreate.mockResolvedValue({ id: "job-2", status: "PENDING" })
    const res = await enqueueSyncJob("c1")
    expect(res).toEqual({ id: "job-2", status: "PENDING" })
    expect(syncJobCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { connectionId: "c1" } })
    )
  })
})

describe("processSyncJobs", () => {
  it("stops when there is no due job", async () => {
    queryRaw.mockResolvedValue([])
    const res = await processSyncJobs()
    expect(res).toEqual({ processed: 0 })
    expect(syncDirectoryConnection).not.toHaveBeenCalled()
  })

  it("marks a job SUCCEEDED on a successful sync", async () => {
    queryRaw
      .mockResolvedValueOnce([{ id: "j1", connectionId: "c1", attempts: 0, maxAttempts: 3 }])
      .mockResolvedValue([])
    syncDirectoryConnection.mockResolvedValue({ synced: 3 })

    const res = await processSyncJobs()

    expect(res.processed).toBe(1)
    expect(syncDirectoryConnection).toHaveBeenCalledWith("c1", "co-1")
    expect(syncJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "j1" },
        data: expect.objectContaining({ status: "SUCCEEDED", attempts: 1, lastError: null }),
      })
    )
  })

  it("re-queues with backoff when attempts remain", async () => {
    queryRaw
      .mockResolvedValueOnce([{ id: "j1", connectionId: "c1", attempts: 0, maxAttempts: 3 }])
      .mockResolvedValue([])
    syncDirectoryConnection.mockRejectedValue(new Error("boom"))

    await processSyncJobs()

    const arg = syncJobUpdate.mock.calls[0][0]
    expect(arg.data.status).toBe("PENDING")
    expect(arg.data.attempts).toBe(1)
    expect(arg.data.lastError).toBe("boom")
    expect(arg.data.runAfter).toBeInstanceOf(Date)
  })

  it("marks FAILED once attempts are exhausted", async () => {
    queryRaw
      .mockResolvedValueOnce([{ id: "j1", connectionId: "c1", attempts: 2, maxAttempts: 3 }])
      .mockResolvedValue([])
    syncDirectoryConnection.mockRejectedValue(new Error("still down"))

    await processSyncJobs()

    expect(syncJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED", attempts: 3, lastError: "still down" }),
      })
    )
  })
})
