import { createElement as h } from "react"
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer"
import type { ReportData } from "./types"
import type { ReportSection } from "./html"

type Block = { title: string; headers: string[]; rows: (string | number)[][] }

function blocksFor(sections: ReportSection[], d: ReportData): Block[] {
  const out: Block[] = []
  const want = new Set(sections)

  if (want.has("exposure")) {
    const e = d.exposure
    out.push({
      title: "Exposure summary",
      headers: ["Metric", "Value"],
      rows: [
        ["Total employees", e.totalEmployees],
        ["Exposed employees", e.exposedEmployees],
        ["Exposure rate", `${e.exposureRate}%`],
        ["Total breaches", e.totalBreaches],
        ["Risk score", `${e.riskScore} (${e.riskLabel})`],
        ["Open critical alerts", e.openAlerts.critical],
      ],
    })
  }
  if (want.has("compliance")) {
    const c = d.compliance
    out.push({
      title: "Compliance",
      headers: ["Metric", "Value"],
      rows: [
        ["Monitored employees", c.monitoredEmployees],
        ["Open alerts", c.alertsOpen],
        ["Resolved alerts", c.alertsResolved],
        ["Resolution rate", `${c.resolutionRate}%`],
        ["Open critical alerts", c.criticalOpen],
      ],
    })
  }
  if (want.has("datatypes")) {
    out.push({
      title: "Exposed data types",
      headers: ["Data type", "Records", "Share"],
      rows: d.dataTypes.slice(0, 15).map((t) => [t.label, t.count, `${t.percentage}%`]),
    })
  }
  if (want.has("departments")) {
    out.push({
      title: "Departments",
      headers: ["Department", "Employees", "Exposed", "Rate"],
      rows: d.departments.map((r) => [r.department, r.total, r.exposed, `${r.exposureRate}%`]),
    })
  }
  if (want.has("employees")) {
    out.push({
      title: "Exposed employees",
      headers: ["Employee", "Breaches", "Score", "Risk", "MFA"],
      rows: d.employees
        .filter((e) => e.breachCount > 0)
        .slice(0, 25)
        .map((e) => [
          e.name,
          e.breachCount,
          e.riskScore,
          e.riskLevel,
          e.mfaEnabled === null ? "unknown" : e.mfaEnabled ? "on" : "off",
        ]),
    })
  }
  if (want.has("trends")) {
    out.push({
      title: "Trends",
      headers: ["Month", "Breaches", "Alerts"],
      rows: d.trends.monthly.map((m) => [m.month, m.breaches, m.alerts]),
    })
  }
  return out
}

const BRAND = "#2563eb"
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#111827", fontFamily: "Helvetica" },
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold", color: BRAND },
  meta: { fontSize: 9, color: "#6b7280", marginTop: 2, marginBottom: 8 },
  section: { marginTop: 16 },
  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  headRow: { flexDirection: "row", backgroundColor: "#f3f4f6", borderBottomWidth: 1, borderBottomColor: "#d1d5db" },
  cell: { flex: 1, padding: 5 },
  headCell: { flex: 1, padding: 5, fontFamily: "Helvetica-Bold", fontSize: 9 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: "#9ca3af", textAlign: "center" },
})

function table(block: Block) {
  return h(
    View,
    { key: block.title },
    h(
      View,
      { style: styles.headRow },
      block.headers.map((head, i) => h(Text, { key: i, style: styles.headCell }, head))
    ),
    block.rows.map((row, ri) =>
      h(
        View,
        { key: ri, style: styles.row, wrap: false },
        row.map((cell, ci) => h(Text, { key: ci, style: styles.cell }, String(cell)))
      )
    )
  )
}

// Render a professional, multi-section PDF report. Returns a Buffer suitable for
// an email attachment or an HTTP download.
export function reportPdf(sections: ReportSection[], data: ReportData): Promise<Buffer> {
  const blocks = blocksFor(sections, data)
  const doc = h(
    Document,
    { title: "DataShield report" },
    h(
      Page,
      { size: "A4", style: styles.page },
      h(Text, { style: styles.h1 }, "DataShield report"),
      h(Text, { style: styles.meta }, `Generated ${new Date(data.generatedAt).toUTCString()}`),
      blocks.map((b) =>
        h(View, { key: b.title, style: styles.section }, h(Text, { style: styles.h2 }, b.title), table(b))
      ),
      h(Text, { style: styles.footer, fixed: true }, "DataShield - confidential security report")
    )
  )
  return renderToBuffer(doc)
}
