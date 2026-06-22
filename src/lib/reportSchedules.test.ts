import { describe, it, expect, vi, beforeEach } from "vitest"

const findMany = vi.fn()
const update = vi.fn()
const sendEmail = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reportSchedule: {
      findMany: (a: unknown) => findMany(a),
      update: (a: unknown) => update(a),
    },
  },
}))
vi.mock("@/lib/reports", () => ({ getReportData: () => Promise.resolve({ generatedAt: "now" }) }))
vi.mock("@/lib/reports/csv", () => ({ reportCsv: () => "csv" }))
vi.mock("@/lib/reports/html", () => ({ reportHtml: () => "<html></html>" }))
vi.mock("@/lib/reports/pdf", () => ({ reportPdf: () => Promise.resolve(Buffer.from("pdf")) }))
vi.mock("@/lib/email", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }))
vi.mock("@/lib/scheduler", () => ({
  isDue: (last: Date | null, mins: number, now: Date) =>
    !last || now.getTime() - last.getTime() >= mins * 60_000,
}))

import { isReportSection, runDueReportSchedules } from "./reportSchedules"

const NOW = new Date("2026-06-22T00:00:00Z")
const longAgo = new Date("2026-01-01T00:00:00Z")

beforeEach(() => {
  vi.clearAllMocks()
  sendEmail.mockResolvedValue(true)
  update.mockResolvedValue({})
})

describe("isReportSection", () => {
  it("accepts known sections and rejects others", () => {
    expect(isReportSection("exposure")).toBe(true)
    expect(isReportSection("bogus")).toBe(false)
  })
})

describe("runDueReportSchedules", () => {
  const base = { id: "s1", companyId: "co1", frequency: "WEEKLY" as const, recipients: ["a@x.com"], sections: ["exposure"] }

  it("sends a due schedule and stamps lastSentAt", async () => {
    findMany.mockResolvedValue([{ ...base, lastSentAt: longAgo }])
    const res = await runDueReportSchedules(NOW)
    expect(res.sent).toBe(1)
    expect(sendEmail).toHaveBeenCalledOnce()
    expect(update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { lastSentAt: NOW } })
  })

  it("skips a schedule whose interval has not elapsed", async () => {
    findMany.mockResolvedValue([{ ...base, lastSentAt: new Date("2026-06-21T00:00:00Z") }])
    const res = await runDueReportSchedules(NOW)
    expect(res.sent).toBe(0)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("does not stamp lastSentAt when the email fails", async () => {
    findMany.mockResolvedValue([{ ...base, lastSentAt: longAgo }])
    sendEmail.mockResolvedValue(false)
    const res = await runDueReportSchedules(NOW)
    expect(res.sent).toBe(0)
    expect(update).not.toHaveBeenCalled()
  })
})
