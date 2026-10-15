import { describe, it, expect, vi, beforeEach } from "vitest"

const db = vi.hoisted(() => ({
  employee: { findFirst: vi.fn() },
  breach: { findFirst: vi.fn() },
  alert: { findFirst: vi.fn() },
  remediationAction: { findMany: vi.fn() },
}))
vi.mock("@/lib/prisma", () => ({ prisma: db }))

import { alertDetail, breachDetail, employeeDetail } from "./builders"

const day = new Date("2024-01-16T00:00:00Z")
const breach = {
  name: "Trello",
  source: "HIBP",
  breachDate: day,
  dataTypes: ["email_addresses"],
  description: null,
}
const record = {
  breach,
  detectedAt: day,
  exposedData: ["email_addresses", "names"],
  artifacts: [],
  sources: ["HIBP"],
  malwareFamily: null,
  machineId: null,
  capturedAt: null,
}
const person = {
  firstName: "Ada",
  lastName: "Vale",
  email: "ada@example.com",
  department: "R&D",
  mfaEnabled: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  db.remediationAction.findMany.mockResolvedValue([])
})

describe("employeeDetail", () => {
  it("returns null for an employee outside the company", async () => {
    db.employee.findFirst.mockResolvedValue(null)
    expect(await employeeDetail("e1", "c1")).toBeNull()
    expect(db.employee.findFirst.mock.calls[0]?.[0].where).toEqual({ id: "e1", companyId: "c1" })
  })

  it("summarises the employee, then one group per breach and the remediation log", async () => {
    db.employee.findFirst.mockResolvedValue({
      ...person,
      breachRecords: [record],
      alerts: [{ status: "OPEN" }],
    })
    db.remediationAction.findMany.mockResolvedValue([
      { action: "REVOKE_SESSIONS", status: "SUCCESS", createdAt: day },
    ])
    const detail = await employeeDetail("e1", "c1")
    expect(detail).toMatchObject({ title: "Ada Vale", subtitle: "R&D", variant: "critical" })
    expect(detail!.groups[0]?.fields).toContainEqual({ label: "MFA", value: "Unknown" })
    expect(detail!.groups[1]).toMatchObject({ heading: "Trello" })
    expect(detail!.groups[1]?.fields).toContainEqual({
      label: "Exposed data",
      value: "email addresses, names",
    })
    expect(detail!.groups[2]).toEqual({
      heading: "Remediation",
      fields: [{ label: "REVOKE_SESSIONS (SUCCESS)", value: "Jan 16, 2024" }],
    })
  })
})

describe("breachDetail", () => {
  it("hides a breach that touched no employee of the company", async () => {
    db.breach.findFirst.mockResolvedValue({
      ...breach,
      records: [{ ...record, employee: { ...person, companyId: "other" } }],
    })
    expect(await breachDetail("b1", "c1")).toBeNull()
  })

  it("lists only the company's own affected employees", async () => {
    db.breach.findFirst.mockResolvedValue({
      ...breach,
      records: [
        { ...record, employee: { ...person, companyId: "c1" } },
        { ...record, employee: { ...person, firstName: "Eve", companyId: "other" } },
      ],
    })
    const detail = await breachDetail("b1", "c1")
    expect(detail!.groups[0]?.fields).toContainEqual({ label: "Affected employees", value: 1 })
    expect(detail!.groups.slice(1).map((g) => g.heading)).toEqual(["Ada Vale"])
    expect(detail!.tags).toEqual(["email addresses"])
  })
})

describe("alertDetail", () => {
  it("returns null for an alert outside the company", async () => {
    db.alert.findFirst.mockResolvedValue(null)
    expect(await alertDetail("a1", "c1")).toBeNull()
  })

  it("adds the employee and breach groups when the alert has them", async () => {
    db.alert.findFirst.mockResolvedValue({
      severity: "HIGH",
      confidence: "HIGH",
      status: "OPEN",
      createdAt: day,
      message: "Ada Vale found in Trello breach.",
      employee: { ...person, mfaEnabled: true, breachRecords: [record] },
      breach,
    })
    const detail = await alertDetail("a1", "c1")
    expect(detail).toMatchObject({ title: "Ada Vale", subtitle: "Trello", variant: "high" })
    expect(detail!.groups.map((g) => g.heading)).toEqual([undefined, "Ada Vale", "Trello"])
    expect(detail!.groups[1]?.fields).toContainEqual({ label: "MFA", value: "Enabled" })
  })

  it("falls back to a generic title without an employee", async () => {
    db.alert.findFirst.mockResolvedValue({
      severity: "LOW",
      confidence: "LOW",
      status: "OPEN",
      createdAt: day,
      message: "m",
      employee: null,
      breach: null,
    })
    expect(await alertDetail("a1", "c1")).toMatchObject({ title: "Alert", subtitle: "LOW", variant: "low" })
  })
})
