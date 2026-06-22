import type { ReportData } from "./types"

export type ReportSection = "exposure" | "datatypes" | "departments" | "employees" | "trends" | "compliance"

function esc(value: string | number): string {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function table(headers: string[], rows: (string | number)[][]): string {
  const head = headers.map((h) => `<th align="left">${esc(h)}</th>`).join("")
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("")
  return `<table cellpadding="6" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="border-bottom:1px solid #ccc">${head}</tr></thead><tbody>${body}</tbody></table>`
}

function exposureSection(d: ReportData): string {
  const e = d.exposure
  return table(
    ["Metric", "Value"],
    [
      ["Total employees", e.totalEmployees],
      ["Exposed employees", e.exposedEmployees],
      ["Exposure rate", `${e.exposureRate}%`],
      ["Total breaches", e.totalBreaches],
      ["Risk score", `${e.riskScore} (${e.riskLabel})`],
      ["Open critical alerts", e.openAlerts.critical],
    ]
  )
}

function complianceSection(d: ReportData): string {
  const c = d.compliance
  return table(
    ["Metric", "Value"],
    [
      ["Monitored employees", c.monitoredEmployees],
      ["Open alerts", c.alertsOpen],
      ["Resolved alerts", c.alertsResolved],
      ["Resolution rate", `${c.resolutionRate}%`],
      ["Open critical alerts", c.criticalOpen],
    ]
  )
}

function dataTypesSection(d: ReportData): string {
  return table(
    ["Data type", "Records", "Share"],
    d.dataTypes.slice(0, 15).map((t) => [t.label, t.count, `${t.percentage}%`])
  )
}

function departmentsSection(d: ReportData): string {
  return table(
    ["Department", "Employees", "Exposed", "Rate"],
    d.departments.map((r) => [r.department, r.total, r.exposed, `${r.exposureRate}%`])
  )
}

function employeesSection(d: ReportData): string {
  return table(
    ["Employee", "Breaches", "Score", "Risk", "MFA"],
    d.employees
      .filter((e) => e.breachCount > 0)
      .slice(0, 25)
      .map((e) => [
        e.name,
        e.breachCount,
        e.riskScore,
        e.riskLevel,
        e.mfaEnabled === null ? "unknown" : e.mfaEnabled ? "on" : "off",
      ])
  )
}

function trendsSection(d: ReportData): string {
  return table(
    ["Month", "Breaches", "Alerts"],
    d.trends.monthly.map((m) => [m.month, m.breaches, m.alerts])
  )
}

const RENDERERS: Record<ReportSection, { title: string; render: (d: ReportData) => string }> = {
  exposure: { title: "Exposure summary", render: exposureSection },
  compliance: { title: "Compliance", render: complianceSection },
  datatypes: { title: "Exposed data types", render: dataTypesSection },
  departments: { title: "Departments", render: departmentsSection },
  employees: { title: "Exposed employees", render: employeesSection },
  trends: { title: "Trends", render: trendsSection },
}

// A self-contained, print-ready HTML report for the selected sections. Sent as
// the body of the scheduled email; recipients can print it to PDF.
export function reportHtml(sections: ReportSection[], data: ReportData): string {
  const blocks = sections
    .filter((s) => s in RENDERERS)
    .map((s) => `<h2 style="font-size:15px;margin:24px 0 8px">${RENDERERS[s].title}</h2>${RENDERERS[s].render(data)}`)
    .join("")

  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#111;max-width:760px;margin:0 auto;padding:24px">
    <h1 style="font-size:20px;margin:0">DataShield report</h1>
    <p style="color:#666;font-size:12px;margin:4px 0 0">Generated ${esc(new Date(data.generatedAt).toUTCString())}</p>
    ${blocks}
  </body></html>`
}
