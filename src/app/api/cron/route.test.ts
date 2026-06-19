import { describe, it, expect, vi, beforeEach } from "vitest"

const runDueSchedules = vi.fn()
vi.mock("@/lib/scheduler", () => ({ runDueSchedules: () => runDueSchedules() }))

import { POST } from "./route"

function req(auth?: string): Request {
  const headers = new Headers()
  if (auth !== undefined) headers.set("authorization", auth)
  return new Request("http://localhost/api/cron", { method: "POST", headers })
}

beforeEach(() => {
  vi.clearAllMocks()
  runDueSchedules.mockResolvedValue({ syncsEnqueued: 1, scansStarted: 0, jobsProcessed: 1 })
})

describe("POST /api/cron", () => {
  it("returns 503 when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET
    const res = await POST(req("Bearer x"))
    expect(res.status).toBe(503)
    expect(runDueSchedules).not.toHaveBeenCalled()
  })

  it("returns 401 on a missing or wrong secret", async () => {
    process.env.CRON_SECRET = "right"
    expect((await POST(req())).status).toBe(401)
    expect((await POST(req("Bearer wrong"))).status).toBe(401)
    expect(runDueSchedules).not.toHaveBeenCalled()
    delete process.env.CRON_SECRET
  })

  it("runs the scheduler on a valid secret", async () => {
    process.env.CRON_SECRET = "right"
    const res = await POST(req("Bearer right"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ syncsEnqueued: 1, scansStarted: 0, jobsProcessed: 1 })
    expect(runDueSchedules).toHaveBeenCalled()
    delete process.env.CRON_SECRET
  })
})
