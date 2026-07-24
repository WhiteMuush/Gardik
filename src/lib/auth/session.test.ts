import { describe, it, expect, vi, beforeEach } from "vitest"

const getSession = vi.fn()
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }))

const findCompany = vi.fn()
vi.mock("@/lib/prisma", () => ({
  prisma: { company: { findUnique: (a: unknown) => findCompany(a) } },
}))

import { requireAuth, requireAdmin } from "@/lib/apiAuth"

beforeEach(() => {
  vi.clearAllMocks()
  // Default: company does not force 2FA, so enrolled state is irrelevant.
  findCompany.mockResolvedValue({ require2fa: false })
})

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

describe("forced 2FA enrollment", () => {
  it("blocks an un-enrolled user when the company requires 2FA", async () => {
    getSession.mockResolvedValue({
      user: { id: "u1", role: "VIEWER", companyId: "co1", twoFactorEnabled: false },
    })
    findCompany.mockResolvedValue({ require2fa: true })
    const { session, error } = await requireAuth()
    expect(session).toBeNull()
    expect(error?.status).toBe(403)
  })

  it("blocks an un-enrolled admin when the company requires 2FA", async () => {
    getSession.mockResolvedValue({
      user: { id: "u1", role: "ADMIN", companyId: "co1", twoFactorEnabled: false },
    })
    findCompany.mockResolvedValue({ require2fa: true })
    const { error } = await requireAdmin()
    expect(error?.status).toBe(403)
  })

  it("lets an enrolled user through without querying the company", async () => {
    getSession.mockResolvedValue({
      user: { id: "u1", role: "VIEWER", companyId: "co1", twoFactorEnabled: true },
    })
    const { error } = await requireAuth()
    expect(error).toBeNull()
    expect(findCompany).not.toHaveBeenCalled()
  })
})
