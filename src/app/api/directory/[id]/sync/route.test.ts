import { describe, it, expect, vi, beforeEach } from "vitest"

const requirePermission = vi.fn()
const findFirst = vi.fn()
const enqueueSyncJob = vi.fn()
const processSyncJobs = vi.fn()

vi.mock("@/lib/apiAuth", () => ({ requirePermission: () => requirePermission() }))
vi.mock("@/lib/prisma", () => ({
  prisma: { directoryConnection: { findFirst: (a: unknown) => findFirst(a) } },
}))
vi.mock("@/lib/directory/jobs", () => ({
  enqueueSyncJob: (id: string) => enqueueSyncJob(id),
  processSyncJobs: () => processSyncJobs(),
}))

import { POST } from "./route"

const params = Promise.resolve({ id: "conn-1" })
const req = new Request("http://localhost/api/directory/conn-1/sync", { method: "POST" })

beforeEach(() => {
  vi.clearAllMocks()
  requirePermission.mockResolvedValue({ session: { user: { companyId: "co-1" } }, error: null })
  findFirst.mockResolvedValue({ id: "conn-1" })
  enqueueSyncJob.mockResolvedValue({ id: "job-1", status: "PENDING" })
  processSyncJobs.mockResolvedValue({ processed: 1 })
})

describe("POST /api/directory/[id]/sync", () => {
  it("propagates the auth error without enqueueing", async () => {
    const error = { status: 401 } as unknown
    requirePermission.mockResolvedValue({ session: null, error })

    const res = await POST(req, { params })

    expect(res).toBe(error)
    expect(enqueueSyncJob).not.toHaveBeenCalled()
  })

  it("returns 404 when the connection is not in the caller's company", async () => {
    findFirst.mockResolvedValue(null)

    const res = await POST(req, { params })

    expect(res.status).toBe(404)
    expect(enqueueSyncJob).not.toHaveBeenCalled()
  })

  it("enqueues a job and returns 202 with the job id", async () => {
    const res = await POST(req, { params })

    expect(enqueueSyncJob).toHaveBeenCalledWith("conn-1")
    expect(res.status).toBe(202)
    expect(await res.json()).toEqual({ jobId: "job-1", status: "PENDING" })
  })

  it("scopes the lookup to the caller's company", async () => {
    await POST(req, { params })
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "conn-1", companyId: "co-1" } })
    )
  })
})
