import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const companyFindMany = vi.fn()
const companyUpdate = vi.fn()
const alertFindMany = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: { findMany: (a: unknown) => companyFindMany(a), update: (a: unknown) => companyUpdate(a) },
    alert: { findMany: (a: unknown) => alertFindMany(a) },
  },
}))
vi.mock("@/lib/directory/crypto", () => ({ decryptConfig: () => ({ url: "https://collector.example.com" }) }))

import { runDueSiemPush } from "./siem"

const NOW = new Date("2026-06-22T00:00:00Z")
const alertRow = {
  id: "al1",
  severity: "CRITICAL",
  confidence: "HIGH",
  status: "OPEN",
  message: "m",
  createdAt: NOW,
  employee: { email: "e@x.com" },
  breach: { name: "Acme" },
}

beforeEach(() => {
  vi.clearAllMocks()
  companyUpdate.mockResolvedValue({})
})
afterEach(() => vi.restoreAllMocks())

describe("runDueSiemPush", () => {
  it("POSTs new alerts and advances the watermark on success", async () => {
    companyFindMany.mockResolvedValue([
      { id: "co1", siemPushUrlEnc: "enc", siemPushFormat: "cef", siemPushSince: null },
    ])
    alertFindMany.mockResolvedValue([alertRow])
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({ ok: true } as Response)

    const res = await runDueSiemPush(NOW)

    expect(res.pushed).toBe(1)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(companyUpdate).toHaveBeenCalledWith({ where: { id: "co1" }, data: { siemPushSince: NOW } })
  })

  it("does not advance the watermark when the POST fails", async () => {
    companyFindMany.mockResolvedValue([
      { id: "co1", siemPushUrlEnc: "enc", siemPushFormat: "cef", siemPushSince: null },
    ])
    alertFindMany.mockResolvedValue([alertRow])
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: false } as Response)

    const res = await runDueSiemPush(NOW)

    expect(res.pushed).toBe(0)
    expect(companyUpdate).not.toHaveBeenCalled()
  })

  it("advances the watermark with no work when there are no new alerts", async () => {
    companyFindMany.mockResolvedValue([
      { id: "co1", siemPushUrlEnc: "enc", siemPushFormat: "cef", siemPushSince: NOW },
    ])
    alertFindMany.mockResolvedValue([])
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({ ok: true } as Response)

    const res = await runDueSiemPush(NOW)

    expect(res.pushed).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(companyUpdate).toHaveBeenCalledWith({ where: { id: "co1" }, data: { siemPushSince: NOW } })
  })
})
