import { describe, it, expect, vi, beforeEach } from "vitest"

const requireAdmin = vi.fn()
const queryRaw = vi.fn()
const transaction = vi.fn()
const syncDirectoryConnection = vi.fn()

vi.mock("@/lib/apiAuth", () => ({ requireAdmin: () => requireAdmin() }))
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (cb: unknown) => transaction(cb) } }))
vi.mock("@/lib/directory/sync", () => ({
  syncDirectoryConnection: (id: string, companyId: string) =>
    syncDirectoryConnection(id, companyId),
}))

import { POST } from "./route"

const params = Promise.resolve({ id: "conn-1" })
const req = new Request("http://localhost/api/directory/conn-1/sync", { method: "POST" })

// $transaction runs the callback with a tx whose $queryRaw yields the lock result.
function withLock(locked: boolean) {
  queryRaw.mockResolvedValue([{ locked }])
  transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
    cb({ $queryRaw: () => queryRaw() })
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  requireAdmin.mockResolvedValue({ session: { user: { companyId: "co-1" } }, error: null })
})

describe("POST /api/directory/[id]/sync", () => {
  it("returns 401-style error from requireAdmin without touching the lock", async () => {
    const error = NextResponseLike(401)
    requireAdmin.mockResolvedValue({ session: null, error })

    const res = await POST(req, { params })

    expect(res).toBe(error)
    expect(transaction).not.toHaveBeenCalled()
  })

  it("runs the sync when the advisory lock is acquired", async () => {
    withLock(true)
    syncDirectoryConnection.mockResolvedValue({ synced: 42 })

    const res = await POST(req, { params })

    expect(syncDirectoryConnection).toHaveBeenCalledWith("conn-1", "co-1")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ synced: 42 })
  })

  it("returns 409 and skips the sync when the lock is held elsewhere", async () => {
    withLock(false)

    const res = await POST(req, { params })

    expect(syncDirectoryConnection).not.toHaveBeenCalled()
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: "Sync already running" })
  })

  it("returns 500 when the sync throws", async () => {
    withLock(true)
    syncDirectoryConnection.mockRejectedValue(new Error("boom"))

    const res = await POST(req, { params })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "boom" })
  })
})

function NextResponseLike(status: number) {
  return { status, body: "auth" } as unknown
}
