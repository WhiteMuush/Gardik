import { describe, it, expect } from "vitest"
import { formatAlerts, toCef, toSyslog, type SiemAlert } from "./index"

const alert: SiemAlert = {
  id: "al_1",
  severity: "CRITICAL",
  status: "OPEN",
  message: "Jane Doe found in Acme breach",
  employeeEmail: "jane@acme.com",
  breachName: "Acme",
  createdAt: new Date("2026-06-22T10:00:00.000Z"),
}

describe("toCef", () => {
  it("emits a CEF header with mapped severity and extension fields", () => {
    const line = toCef(alert)
    expect(line.startsWith("CEF:0|DataShield|DataShield|1.0|breach-exposure|Jane Doe found in Acme breach|10|")).toBe(true)
    expect(line).toContain("suser=jane@acme.com")
    expect(line).toContain("cs1=Acme")
  })

  it("escapes pipes in the name and equals in extensions", () => {
    const line = toCef({ ...alert, message: "a|b", breachName: "x=y" })
    expect(line).toContain("|a\\|b|")
    expect(line).toContain("cs1=x\\=y")
  })
})

describe("toSyslog", () => {
  it("emits RFC 5424 with the right priority and structured data", () => {
    const line = toSyslog(alert)
    // facility 10 * 8 + severity 2 (crit) = 82
    expect(line.startsWith("<82>1 2026-06-22T10:00:00.000Z datashield datashield - breach-exposure ")).toBe(true)
    expect(line).toContain('alertId="al_1"')
    expect(line).toContain('employee="jane@acme.com"')
    expect(line.endsWith("Jane Doe found in Acme breach")).toBe(true)
  })
})

describe("formatAlerts", () => {
  it("joins cef lines with newlines", () => {
    expect(formatAlerts([alert, alert], "cef").split("\n")).toHaveLength(2)
  })

  it("emits a json array for the json format", () => {
    const parsed = JSON.parse(formatAlerts([alert], "json"))
    expect(parsed[0]).toMatchObject({ id: "al_1", employee: "jane@acme.com", breach: "Acme" })
  })
})
