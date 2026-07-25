import { describe, it, expect, vi, beforeEach } from "vitest"

const requirePermission = vi.fn()
const findFirst = vi.fn()
const update = vi.fn()

vi.mock("@/lib/apiAuth", () => ({ requirePermission: () => requirePermission() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    directoryConnection: {
      findFirst: (a: unknown) => findFirst(a),
      update: (a: unknown) => update(a),
    },
  },
}))

import { PATCH } from "./route"

const params = Promise.resolve({ id: "c1" })
function patch(body: unknown): Request {
  return new Request("http://localhost/api/directory/c1", {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  requirePermission.mockResolvedValue({ session: { user: { companyId: "co1" } }, error: null })
  findFirst.mockResolvedValue({ type: "OKTA" })
})

describe("PATCH /api/directory/[id]", () => {
  it("rejects an interval below the minimum", async () => {
    const res = await PATCH(patch({ autoSyncIntervalMinutes: 1 }), { params })
    expect(res.status).toBe(400)
    expect(update).not.toHaveBeenCalled()
  })

  it("returns 404 for a connection outside the company", async () => {
    findFirst.mockResolvedValue(null)
    const res = await PATCH(patch({ autoSyncIntervalMinutes: 60 }), { params })
    expect(res.status).toBe(404)
  })

  it("rejects a pull schedule on a SCIM connection", async () => {
    findFirst.mockResolvedValue({ type: "SCIM" })
    const res = await PATCH(patch({ autoSyncIntervalMinutes: 60 }), { params })
    expect(res.status).toBe(400)
    expect(update).not.toHaveBeenCalled()
  })

  it("sets the interval", async () => {
    const res = await PATCH(patch({ autoSyncIntervalMinutes: 60 }), { params })
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "c1" }, data: { autoSyncIntervalMinutes: 60 } })
    )
  })

  it("disables auto-sync with null (allowed for SCIM too)", async () => {
    findFirst.mockResolvedValue({ type: "SCIM" })
    const res = await PATCH(patch({ autoSyncIntervalMinutes: null }), { params })
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { autoSyncIntervalMinutes: null } })
    )
  })
})
