import { describe, it, expect, vi, beforeEach } from "vitest"

const requirePermission = vi.fn()
const update = vi.fn()

vi.mock("@/lib/apiAuth", () => ({ requirePermission: () => requirePermission() }))
vi.mock("@/lib/prisma", () => ({
  prisma: { company: { update: (a: unknown) => update(a) } },
}))

import { PATCH } from "./route"

function patch(body: unknown): Request {
  return new Request("http://localhost/api/company/auth-policy", {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  requirePermission.mockResolvedValue({ session: { user: { companyId: "co1" } }, error: null })
})

describe("PATCH /api/company/auth-policy", () => {
  it("rejects an unknown method", async () => {
    const res = await PATCH(patch({ allowedAuthMethods: ["SMS"] }))
    expect(res.status).toBe(400)
    expect(update).not.toHaveBeenCalled()
  })

  it("rejects an empty allowedAuthMethods list", async () => {
    const res = await PATCH(patch({ allowedAuthMethods: [] }))
    expect(res.status).toBe(400)
    expect(update).not.toHaveBeenCalled()
  })

  it("updates the policy scoped to the caller's company", async () => {
    const out = await PATCH(patch({ require2fa: true, allowedAuthMethods: ["TOTP"] }))
    expect(out.status).toBe(200)
    expect(update).toHaveBeenCalledWith({
      where: { id: "co1" },
      data: { require2fa: true, allowedAuthMethods: ["TOTP"] },
    })
  })
})
