import { describe, it, expect, vi, beforeEach } from "vitest"

const requireAdmin = vi.fn()
const update = vi.fn()

vi.mock("@/lib/apiAuth", () => ({ requireAdmin: () => requireAdmin() }))
vi.mock("@/lib/prisma", () => ({
  prisma: { company: { update: (a: unknown) => update(a) } },
}))

import { PATCH } from "./route"

function patch(body: unknown): Request {
  return new Request("http://localhost/api/company", {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  requireAdmin.mockResolvedValue({ session: { user: { companyId: "co1" } }, error: null })
})

describe("PATCH /api/company", () => {
  it("rejects a non-integer interval", async () => {
    const res = await PATCH(patch({ scanIntervalMinutes: 2.5 }))
    expect(res.status).toBe(400)
    expect(update).not.toHaveBeenCalled()
  })

  it("sets the scan interval scoped to the caller's company", async () => {
    const res = await PATCH(patch({ scanIntervalMinutes: 1440 }))
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledWith({
      where: { id: "co1" },
      data: { scanIntervalMinutes: 1440 },
    })
  })

  it("disables scheduled scans with null", async () => {
    const res = await PATCH(patch({ scanIntervalMinutes: null }))
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledWith({
      where: { id: "co1" },
      data: { scanIntervalMinutes: null },
    })
  })
})
