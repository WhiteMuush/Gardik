import { describe, it, expect, vi, beforeEach } from "vitest"

const getSession = vi.fn()
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }))

import { requireAuth, requireAdmin } from "@/lib/apiAuth"

beforeEach(() => vi.clearAllMocks())

describe("requireAuth", () => {
  it("returns 401 when there is no session", async () => {
    getSession.mockResolvedValue(null)
    const { session, error } = await requireAuth()
    expect(session).toBeNull()
    expect(error?.status).toBe(401)
  })

  it("passes the session through when authenticated", async () => {
    getSession.mockResolvedValue({ user: { id: "u1", role: "VIEWER", companyId: "co1" } })
    const { session, error } = await requireAuth()
    expect(error).toBeNull()
    expect(session?.user.companyId).toBe("co1")
  })
})

describe("requireAdmin", () => {
  it("returns 403 for a non-admin", async () => {
    getSession.mockResolvedValue({ user: { id: "u1", role: "VIEWER", companyId: "co1" } })
    const { error } = await requireAdmin()
    expect(error?.status).toBe(403)
  })

  it("allows an admin", async () => {
    getSession.mockResolvedValue({ user: { id: "u1", role: "ADMIN", companyId: "co1" } })
    const { session, error } = await requireAdmin()
    expect(error).toBeNull()
    expect(session?.user.role).toBe("ADMIN")
  })
})
