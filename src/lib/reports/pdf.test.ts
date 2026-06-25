import { describe, it, expect } from "vitest"
import { reportPdf } from "./pdf"
import type { ReportData } from "./types"

const data: ReportData = {
  generatedAt: "2026-06-22T00:00:00.000Z",
  org: { name: "Acme Corp", domain: "acme.example" },
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

const rich: ReportData = {
  ...data,
  findings: [
    { severity: "critical", message: "1 critical alert open" },
    { severity: "ok", message: "MFA enabled for most staff" },
  ],
  dataTypes: [
    { type: "password", label: "Passwords", count: 120, percentage: 60, critical: true },
    { type: "email", label: "Emails", count: 80, percentage: 40, critical: false },
  ],
  departments: [{ department: "Engineering", total: 8, exposed: 5, exposureRate: 63 }],
  employees: [
    {
      name: "Ada Lovelace",
      email: "ada@example.com",
      department: "Engineering",
      breachCount: 3,
      exposedDataTypes: ["password"],
      lastDetectedAt: null,
      riskScore: 70,
      riskLevel: "HIGH",
      mfaEnabled: false,
    },
  ],
  trends: { monthly: [{ month: "2026-05", breaches: 1, alerts: 2 }] },
  deltas: {
    windowLabel: "30d",
    newlyExposed: { current: 2, previous: 1 },
    newBreaches: { current: 1, previous: 1 },
    newAlerts: { current: 0, previous: 3 },
  },
}

describe("reportPdf", () => {
  it("renders a non-empty PDF buffer with the PDF magic header", async () => {
    const buf = await reportPdf(["exposure", "compliance"], data)
    expect(buf.length).toBeGreaterThan(500)
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-")
  })

  it("renders every section with rich data without throwing", async () => {
    const buf = await reportPdf(
      ["exposure", "compliance", "datatypes", "departments", "employees", "trends"],
      rich,
    )
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-")
    // The richer document is materially larger than the empty-data baseline.
    const baseline = await reportPdf(["exposure"], data)
    expect(buf.length).toBeGreaterThan(baseline.length)
  })
})
