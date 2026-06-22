import { describe, it, expect } from "vitest"
import {
  buildEmployeeRiskInput,
  DEFAULT_RISK_WEIGHTS,
  employeeRiskScore,
  resolveRiskWeights,
  type EmployeeRiskInput,
} from "./risk"

const base: EmployeeRiskInput = {
  breachCount: 0,
  recencyDays: null,
  hasSessionArtifact: false,
  hasCriticalData: false,
  domainMatch: false,
  openAlerts: 0,
}

describe("employeeRiskScore", () => {
  it("is 0 with no exposure", () => {
    expect(employeeRiskScore(base)).toBe(0)
  })

  it("ranks a captured session above a plaintext password", () => {
    const session = employeeRiskScore({ ...base, breachCount: 1, hasSessionArtifact: true })
    const password = employeeRiskScore({ ...base, breachCount: 1, hasCriticalData: true })
    expect(session).toBeGreaterThan(password)
  })

  it("decays the recency component with age", () => {
    const fresh = employeeRiskScore({ ...base, breachCount: 1, recencyDays: 0 })
    const old = employeeRiskScore({ ...base, breachCount: 1, recencyDays: 200 })
    expect(fresh).toBeGreaterThan(old)
  })

  it("caps the open-alert contribution", () => {
    const three = employeeRiskScore({ ...base, breachCount: 1, openAlerts: 3 })
    const ten = employeeRiskScore({ ...base, breachCount: 1, openAlerts: 10 })
    expect(three).toBe(ten)
  })

  it("never exceeds 100", () => {
    const max = employeeRiskScore({
      breachCount: 9,
      recencyDays: 0,
      hasSessionArtifact: true,
      hasCriticalData: true,
      domainMatch: true,
      openAlerts: 9,
    })
    expect(max).toBeLessThanOrEqual(100)
  })
})

describe("buildEmployeeRiskInput", () => {
  const now = new Date("2026-06-22T00:00:00Z")

  it("flags a session artifact and a domain match", () => {
    const input = buildEmployeeRiskInput({
      email: "jane@acme.com",
      companyDomain: "acme.com",
      records: [{ detectedAt: new Date("2026-06-20T00:00:00Z"), exposedData: ["email"], artifacts: ["COOKIE"] }],
      openAlerts: 1,
      now,
    })
    expect(input.hasSessionArtifact).toBe(true)
    expect(input.domainMatch).toBe(true)
    expect(input.recencyDays).toBe(2)
    expect(input.breachCount).toBe(1)
  })

  it("does not match a foreign domain", () => {
    const input = buildEmployeeRiskInput({
      email: "jane@gmail.com",
      companyDomain: "acme.com",
      records: [],
      openAlerts: 0,
      now,
    })
    expect(input.domainMatch).toBe(false)
    expect(input.recencyDays).toBeNull()
  })
})

describe("resolveRiskWeights", () => {
  it("falls back to defaults for junk input", () => {
    expect(resolveRiskWeights(null)).toEqual(DEFAULT_RISK_WEIGHTS)
    expect(resolveRiskWeights("nope")).toEqual(DEFAULT_RISK_WEIGHTS)
  })

  it("merges valid overrides and ignores invalid ones", () => {
    const w = resolveRiskWeights({ session: 50, recency: -3, bogus: 9 })
    expect(w.session).toBe(50)
    expect(w.recency).toBe(DEFAULT_RISK_WEIGHTS.recency)
  })
})
