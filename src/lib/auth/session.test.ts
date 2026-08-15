import { describe, it, expect, vi, beforeEach } from "vitest"

const getSession = vi.fn()
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }))

const findCompany = vi.fn()
const findRole = vi.fn()
vi.mock("@/lib/prisma", () => ({
  prisma: {
    // The API guard rate-limits per user, which goes through a raw upsert.
    $queryRaw: async () => [{ count: 1 }],
    company: { findUnique: (a: unknown) => findCompany(a) },
    role: { findUnique: (a: unknown) => findRole(a) },
  },
}))

import { requireAuth, requirePermission } from "@/lib/apiAuth"

beforeEach(() => {
  vi.clearAllMocks()
  // Default: company does not force 2FA, so enrolled state is irrelevant.
  findCompany.mockResolvedValue({ require2fa: false })
  findRole.mockResolvedValue({ permissions: [] })
})

describe("requireAuth", () => {
  it("returns 401 when there is no session", async () => {
    getSession.mockResolvedValue(null)
    const { session, error } = await requireAuth()
    expect(session).toBeNull()
    expect(error?.status).toBe(401)
  })

  it("passes the session through when authenticated", async () => {
    getSession.mockResolvedValue({ user: { id: "u1", roleId: "role1", companyId: "co1" } })
    const { session, error } = await requireAuth()
    expect(error).toBeNull()
    expect(session?.user.companyId).toBe("co1")
  })
})

describe("requirePermission", () => {
  it("returns 403 when the role lacks the permission", async () => {
    getSession.mockResolvedValue({ user: { id: "u1", roleId: "role1", companyId: "co1" } })
    findRole.mockResolvedValue({ permissions: [] })
    const { error } = await requirePermission("users:manage")
    expect(error?.status).toBe(403)
  })

  it("returns 403 when the user has no role assigned", async () => {
    getSession.mockResolvedValue({ user: { id: "u1", roleId: null, companyId: "co1" } })
    const { error } = await requirePermission("users:manage")
    expect(error?.status).toBe(403)
    expect(findRole).not.toHaveBeenCalled()
  })

  it("allows access when the role has the permission", async () => {
    getSession.mockResolvedValue({ user: { id: "u1", roleId: "role1", companyId: "co1" } })
    findRole.mockResolvedValue({ permissions: ["users:manage"] })
    const { session, error } = await requirePermission("users:manage")
    expect(error).toBeNull()
    expect(session?.user.roleId).toBe("role1")
  })
})

describe("forced 2FA enrollment", () => {
  it("blocks an un-enrolled user when the company requires 2FA", async () => {
    getSession.mockResolvedValue({
      user: { id: "u1", roleId: "role1", companyId: "co1", twoFactorEnabled: false },
    })
    findCompany.mockResolvedValue({ require2fa: true })
    const { session, error } = await requireAuth()
    expect(session).toBeNull()
    expect(error?.status).toBe(403)
  })

  it("blocks an un-enrolled permitted user when the company requires 2FA", async () => {
    getSession.mockResolvedValue({
      user: { id: "u1", roleId: "role1", companyId: "co1", twoFactorEnabled: false },
    })
    findRole.mockResolvedValue({ permissions: ["users:manage"] })
    findCompany.mockResolvedValue({ require2fa: true })
    const { error } = await requirePermission("users:manage")
    expect(error?.status).toBe(403)
  })

  it("lets an enrolled user through without querying the company", async () => {
    getSession.mockResolvedValue({
      user: { id: "u1", roleId: "role1", companyId: "co1", twoFactorEnabled: true },
    })
    const { error } = await requireAuth()
    expect(error).toBeNull()
    expect(findCompany).not.toHaveBeenCalled()
  })
})
