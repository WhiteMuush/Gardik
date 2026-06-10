import type { ReportData } from "./types"

export type CsvSection = "all" | "exposure" | "employees" | "trends" | "compliance"

type Cell = string | number

function escapeCell(value: Cell): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(headers: string[], rows: Cell[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n")
}

function exposureCsv(d: ReportData): string {
  const e = d.exposure
  const summary = toCsv(
    ["metric", "value"],
    [
      ["Total employees", e.totalEmployees],
      ["Exposed employees", e.exposedEmployees],
      ["Exposure rate (%)", e.exposureRate],
      ["Total breaches", e.totalBreaches],
      ["Risk score", e.riskScore],
      ["Open critical alerts", e.openAlerts.critical],
      ["Open high alerts", e.openAlerts.high],
    ]
  )
  const breaches = toCsv(
    ["breach", "source", "breach date", "affected employees"],
    e.topBreaches.map((b) => [b.name, b.source, b.breachDate, b.affectedEmployees])
  )
  return `${summary}\n\nTop breaches\n${breaches}`
}

function employeesCsv(d: ReportData): string {
  return toCsv(
    ["name", "email", "department", "breaches", "exposed data", "last detected", "risk"],
    d.employees.map((e) => [
      e.name,
      e.email,
      e.department ?? "",
      e.breachCount,
      e.exposedDataTypes.join("; "),
      e.lastDetectedAt ?? "",
      e.riskLevel,
    ])
  )
}

function trendsCsv(d: ReportData): string {
  return toCsv(
    ["month", "breaches", "alerts"],
    d.trends.monthly.map((m) => [m.month, m.breaches, m.alerts])
  )
}

function complianceCsv(d: ReportData): string {
  const c = d.compliance
  return toCsv(
    ["metric", "value"],
    [
      ["Monitored employees", c.monitoredEmployees],
      ["Exposed employees", c.exposedEmployees],
      ["Exposure rate (%)", c.exposureRate],
      ["Total alerts", c.alertsTotal],
      ["Open alerts", c.alertsOpen],
      ["Acknowledged alerts", c.alertsAcknowledged],
      ["Resolved alerts", c.alertsResolved],
      ["Resolution rate (%)", c.resolutionRate],
      ["Open critical alerts", c.criticalOpen],
    ]
  )
}

export function reportCsv(section: CsvSection, d: ReportData): string {
  switch (section) {
    case "exposure":
      return exposureCsv(d)
    case "employees":
      return employeesCsv(d)
    case "trends":
      return trendsCsv(d)
    case "compliance":
      return complianceCsv(d)
    default:
      return [
        `Exposure\n${exposureCsv(d)}`,
        `Employees\n${employeesCsv(d)}`,
        `Trends\n${trendsCsv(d)}`,
        `Compliance\n${complianceCsv(d)}`,
      ].join("\n\n")
  }
}
