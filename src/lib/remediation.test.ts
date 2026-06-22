import { describe, it, expect, vi, beforeEach } from "vitest"

const alertFindFirst = vi.fn()
const connFindMany = vi.fn()
const remediationCreate = vi.fn()
const executeRemediation = vi.fn()
const supportsRemediation = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    alert: { findFirst: (a: unknown) => alertFindFirst(a) },
    directoryConnection: { findMany: (a: unknown) => connFindMany(a) },
    remediationAction: { create: (a: unknown) => remediationCreate(a) },
  },
}))
vi.mock("@/lib/directory/remediation", () => ({
  executeRemediation: (...a: unknown[]) => executeRemediation(...a),
  supportsRemediation: (...a: unknown[]) => supportsRemediation(...a),
}))

import { remediateAlert } from "./remediation"

const params = {
  companyId: "co1",
  alertId: "a1",
  action: "REVOKE_SESSIONS" as const,
  performedBy: "u1",
}

beforeEach(() => {
  vi.clearAllMocks()
  supportsRemediation.mockReturnValue(true)
  remediationCreate.mockResolvedValue({})
})

describe("remediateAlert", () => {
  it("returns NOT_FOUND for an unknown alert", async () => {
    alertFindFirst.mockResolvedValue(null)
    expect(await remediateAlert(params)).toEqual({ ok: false, code: "NOT_FOUND" })
    expect(remediationCreate).not.toHaveBeenCalled()
  })

  it("returns NO_EMPLOYEE when the alert has no employee", async () => {
    alertFindFirst.mockResolvedValue({ id: "a1", employee: null })
    expect(await remediateAlert(params)).toEqual({ ok: false, code: "NO_EMPLOYEE" })
  })

  it("returns NO_CAPABLE_CONNECTION when no connection supports the action", async () => {
    alertFindFirst.mockResolvedValue({ id: "a1", employee: { id: "e1", email: "e@x.com" } })
    connFindMany.mockResolvedValue([{ type: "LDAP", encryptedConfig: "x" }])
    supportsRemediation.mockReturnValue(false)
    expect(await remediateAlert(params)).toEqual({ ok: false, code: "NO_CAPABLE_CONNECTION" })
  })

  it("records a SUCCESS audit row when the provider call resolves", async () => {
    alertFindFirst.mockResolvedValue({ id: "a1", employee: { id: "e1", email: "e@x.com" } })
    connFindMany.mockResolvedValue([{ type: "OKTA", encryptedConfig: "cfg" }])
    executeRemediation.mockResolvedValue(undefined)

    const res = await remediateAlert(params)

    expect(res).toEqual({ ok: true, outcome: { status: "SUCCESS", detail: null } })
    expect(remediationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SUCCESS", target: "e@x.com", performedBy: "u1" }) })
    )
  })

  it("records a FAILED audit row when the provider call throws", async () => {
    alertFindFirst.mockResolvedValue({ id: "a1", employee: { id: "e1", email: "e@x.com" } })
    connFindMany.mockResolvedValue([{ type: "OKTA", encryptedConfig: "cfg" }])
    executeRemediation.mockRejectedValue(new Error("403 forbidden"))

    const res = await remediateAlert(params)

    expect(res).toEqual({ ok: true, outcome: { status: "FAILED", detail: "403 forbidden" } })
    expect(remediationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED", detail: "403 forbidden" }) })
    )
  })
})
