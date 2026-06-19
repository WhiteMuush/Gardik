import { describe, it, expect, vi, beforeEach } from "vitest"

const queryRaw = vi.fn()
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: () => queryRaw() } }))

import { GET } from "./route"

beforeEach(() => vi.clearAllMocks())

describe("GET /api/health", () => {
  it("returns ok when the database is reachable", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }])
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: "ok", db: "up" })
  })

  it("returns 503 when the database query fails", async () => {
    queryRaw.mockRejectedValue(new Error("no db"))
    const res = await GET()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ status: "error", db: "down" })
  })
})
