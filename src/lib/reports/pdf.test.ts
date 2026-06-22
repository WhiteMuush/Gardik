import { describe, it, expect } from "vitest"
import { reportPdf } from "./pdf"
import type { ReportData } from "./types"

const data: ReportData = {
  generatedAt: "2026-06-22T00:00:00.000Z",
  exposure: {
    totalEmployees: 10,
    exposedEmployees: 3,
    exposureRate: 30,
    totalBreaches: 2,
    openAlerts: { critical: 1, high: 0, medium: 0, low: 0 },
    riskScore: 42,
    riskLabel: "Medium risk",
    topBreaches: [],
  },
  compliance: {
    monitoredEmployees: 10,
    exposedEmployees: 3,
    exposureRate: 30,
    alertsTotal: 5,
    alertsOpen: 2,
    alertsAcknowledged: 0,
    alertsResolved: 3,
    resolutionRate: 60,
    criticalOpen: 1,
    staleCriticalOpen: 0,
  },
  dataTypes: [],
  departments: [],
  employees: [],
  trends: { monthly: [] },
  deltas: {
    windowLabel: "30d",
    newlyExposed: { current: 0, previous: 0 },
    newBreaches: { current: 0, previous: 0 },
    newAlerts: { current: 0, previous: 0 },
  },
  findings: [],
}

describe("reportPdf", () => {
  it("renders a non-empty PDF buffer with the PDF magic header", async () => {
    const buf = await reportPdf(["exposure", "compliance"], data)
    expect(buf.length).toBeGreaterThan(500)
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-")
  })
})
