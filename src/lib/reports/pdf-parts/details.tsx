import { View } from "@react-pdf/renderer"
import type { ReportData } from "../types"
import type { ReportSection } from "../html"
import { num, s } from "./theme"
import { SectionHead, Table, type Col } from "./blocks"

// - Detail tables (gated by `sections`) -
type Block = { title: string; lead?: string; cols: Col[]; rows: (string | number)[][] }

function detailBlock(section: ReportSection, d: ReportData): Block | null {
  switch (section) {
    case "exposure":
      return {
        title: "Exposure detail",
        cols: [
          { label: "Metric", flex: 3 },
          { label: "Value", flex: 2, align: "right" },
        ],
        rows: [
          ["Total employees", num(d.exposure.totalEmployees)],
          ["Exposed employees", num(d.exposure.exposedEmployees)],
          ["Exposure rate", `${d.exposure.exposureRate}%`],
          ["Total breaches", num(d.exposure.totalBreaches)],
          ["Risk score", `${d.exposure.riskScore} (${d.exposure.riskLabel})`],
          ["Open critical alerts", num(d.exposure.openAlerts.critical)],
        ],
      }
    case "compliance": {
      const c = d.compliance
      return {
        title: "Compliance",
        cols: [
          { label: "Metric", flex: 3 },
          { label: "Value", flex: 2, align: "right" },
        ],
        rows: [
          ["Monitored employees", num(c.monitoredEmployees)],
          ["Open alerts", num(c.alertsOpen)],
          ["Acknowledged alerts", num(c.alertsAcknowledged)],
          ["Resolved alerts", num(c.alertsResolved)],
          ["Resolution rate", `${c.resolutionRate}%`],
          ["Open critical alerts", num(c.criticalOpen)],
          ["Stale critical (open >7d)", num(c.staleCriticalOpen)],
        ],
      }
    }
    case "datatypes":
      return {
        title: "Exposed data types",
        lead: "Categories of leaked records, most exposed first.",
        cols: [
          { label: "Data type", flex: 5 },
          { label: "Records", flex: 2, align: "right" },
          { label: "Share", flex: 2, align: "right" },
        ],
        rows: d.dataTypes
          .slice(0, 15)
          .map((t) => [t.critical ? `${t.label} (sensitive)` : t.label, num(t.count), `${t.percentage}%`]),
      }
    case "departments":
      return {
        title: "Departments",
        lead: "Exposure concentration across the organisation.",
        cols: [
          { label: "Department", flex: 5 },
          { label: "Staff", flex: 2, align: "right" },
          { label: "Exposed", flex: 2, align: "right" },
          { label: "Rate", flex: 2, align: "right" },
        ],
        rows: d.departments.map((r) => [r.department, num(r.total), num(r.exposed), `${r.exposureRate}%`]),
      }
    case "employees":
      return {
        title: "Most exposed employees",
        lead: "Highest-risk individuals with at least one breach.",
        cols: [
          { label: "Employee", flex: 5 },
          { label: "Breaches", flex: 2, align: "right" },
          { label: "Score", flex: 2, align: "right" },
          { label: "Risk", flex: 2 },
          { label: "MFA", flex: 2 },
        ],
        rows: d.employees
          .filter((e) => e.breachCount > 0)
          .slice(0, 25)
          .map((e) => [
            e.name,
            num(e.breachCount),
            num(e.riskScore),
            e.riskLevel,
            e.mfaEnabled === null ? "unknown" : e.mfaEnabled ? "on" : "off",
          ]),
      }
    case "trends":
      return {
        title: "Monthly trends",
        cols: [
          { label: "Month", flex: 4 },
          { label: "Breaches", flex: 3, align: "right" },
          { label: "Alerts", flex: 3, align: "right" },
        ],
        rows: d.trends.monthly.map((m) => [m.month, num(m.breaches), num(m.alerts)]),
      }
    default:
      return null
  }
}

export function DetailSection({ section, d }: { section: ReportSection; d: ReportData }) {
  const b = detailBlock(section, d)
  if (!b) return null
  // A short table stays glued to its heading, a long one flows across pages.
  return (
    <View style={s.section} wrap={b.rows.length > 16}>
      <SectionHead title={b.title} lead={b.lead} />
      <Table cols={b.cols} rows={b.rows} />
    </View>
  )
}
