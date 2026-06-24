import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer"
import type { ReportData, Finding, FindingSeverity } from "./types"
import type { ReportSection } from "./html"

// - Palette -
const C = {
  brand: "#1d4ed8",
  brandDark: "#172554",
  ink: "#111827",
  muted: "#6b7280",
  faint: "#9ca3af",
  border: "#e5e7eb",
  zebra: "#f9fafb",
  head: "#eef2ff",
  white: "#ffffff",
}

// Severity / risk colours shared by findings, alert bars and the risk badge.
const SEVERITY: Record<FindingSeverity, string> = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#d97706",
  info: "#2563eb",
  ok: "#16a34a",
}

function riskColor(score: number): string {
  if (score >= 76) return SEVERITY.critical
  if (score >= 51) return SEVERITY.high
  if (score >= 26) return SEVERITY.medium
  return SEVERITY.ok
}

const nf = new Intl.NumberFormat("en-US")
const num = (v: number) => nf.format(v)

// - Styles -
const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 56, paddingHorizontal: 40, fontSize: 9.5, color: C.ink, fontFamily: "Helvetica" },

  // Header band (first page)
  band: { backgroundColor: C.brandDark, marginHorizontal: -40, marginTop: -36, paddingHorizontal: 40, paddingTop: 28, paddingBottom: 22, marginBottom: 18 },
  brandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { fontSize: 22, fontFamily: "Helvetica-Bold", color: C.white, letterSpacing: 0.5 },
  brandSub: { fontSize: 11, color: "#c7d2fe", marginTop: 3 },
  confidential: { fontSize: 7.5, color: "#c7d2fe", borderWidth: 1, borderColor: "#4f5fb0", borderRadius: 3, paddingVertical: 2, paddingHorizontal: 6 },
  bandMeta: { fontSize: 8.5, color: "#a5b4fc", marginTop: 14 },

  // Section heading with an accent rule
  section: { marginTop: 16 },
  sectionHead: { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  accent: { width: 3, height: 13, backgroundColor: C.brand, marginRight: 7, borderRadius: 2 },
  h2: { fontSize: 12.5, fontFamily: "Helvetica-Bold", color: C.brandDark },
  lead: { fontSize: 9, color: C.muted, marginBottom: 4 },

  // KPI cards
  kpiRow: { flexDirection: "row", marginHorizontal: -4 },
  kpi: { flex: 1, marginHorizontal: 4, borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingVertical: 9, paddingHorizontal: 10 },
  kpiLabel: { fontSize: 7.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  kpiValue: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 3 },
  kpiFoot: { fontSize: 7.5, color: C.faint, marginTop: 2 },

  // Findings
  finding: { flexDirection: "row", alignItems: "flex-start", marginBottom: 4 },
  findingText: { flex: 1, fontSize: 9.5 },
  badge: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: C.white, borderRadius: 2, paddingVertical: 1, paddingHorizontal: 4, marginRight: 7, marginTop: 1, textTransform: "uppercase" },

  // Delta cards
  deltaCard: { flex: 1, marginHorizontal: 4, borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 9 },
  deltaLabel: { fontSize: 7.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  deltaValue: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 3 },
  deltaChange: { fontSize: 8, marginTop: 2 },

  // Stacked severity bar
  sevBar: { flexDirection: "row", height: 12, borderRadius: 3, overflow: "hidden", marginTop: 4 },
  sevLegend: { flexDirection: "row", marginTop: 6, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", marginRight: 14, marginBottom: 2 },
  legendDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  legendText: { fontSize: 7.5, color: C.muted },

  // Tables
  table: { borderWidth: 1, borderColor: C.border, borderRadius: 5 },
  headRow: { flexDirection: "row", backgroundColor: C.head },
  row: { flexDirection: "row", borderTopWidth: 1, borderTopColor: C.border },
  rowZebra: { backgroundColor: C.zebra },
  headCell: { padding: 5, fontFamily: "Helvetica-Bold", fontSize: 8, color: C.brandDark },
  cell: { padding: 5, fontSize: 8.5 },

  // Inline percentage bar inside a cell
  cellBarWrap: { flexDirection: "row", alignItems: "center" },
  barTrack: { flex: 1, height: 5, backgroundColor: C.border, borderRadius: 3, marginRight: 5 },
  barFill: { height: 5, borderRadius: 3, backgroundColor: C.brand },
  barLabel: { width: 30, fontSize: 8, textAlign: "right" },

  // Footer
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.border, paddingTop: 6 },
  footText: { fontSize: 7.5, color: C.faint },
  empty: { fontSize: 8.5, color: C.faint },
})

// - Building blocks -
function SectionHead({ title, lead }: { title: string; lead?: string }) {
  return (
    <View>
      <View style={s.sectionHead}>
        <View style={s.accent} />
        <Text style={s.h2}>{title}</Text>
      </View>
      {lead ? <Text style={s.lead}>{lead}</Text> : null}
    </View>
  )
}

function Kpi({ label, value, foot, color }: { label: string; value: string; foot?: string; color?: string }) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={[s.kpiValue, color ? { color } : {}]}>{value}</Text>
      {foot ? <Text style={s.kpiFoot}>{foot}</Text> : null}
    </View>
  )
}

type Col = { label: string; flex: number; align?: "left" | "right" }
type Cell = string | number | { bar: number; label: string; color?: string }

function Table({ cols, rows }: { cols: Col[]; rows: Cell[][] }) {
  if (rows.length === 0) return <Text style={s.empty}>No data for this period.</Text>
  // Short tables stay whole so a page break can't orphan their header; long ones
  // must wrap (react-pdf has no native per-table header repeat).
  return (
    <View style={s.table} wrap={rows.length > 14}>
      <View style={s.headRow}>
        {cols.map((c, i) => (
          <Text key={i} style={[s.headCell, { flex: c.flex, textAlign: c.align ?? "left" }]}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={[s.row, ri % 2 === 1 ? s.rowZebra : {}]} wrap={false}>
          {row.map((cell, ci) => {
            const col = cols[ci]
            if (cell !== null && typeof cell === "object") {
              const width = `${Math.max(2, Math.min(100, cell.bar))}%`
              return (
                <View key={ci} style={[s.cell, { flex: col.flex }]}>
                  <View style={s.cellBarWrap}>
                    <View style={s.barTrack}>
                      <View style={[s.barFill, { width }, cell.color ? { backgroundColor: cell.color } : {}]} />
                    </View>
                    <Text style={s.barLabel}>{cell.label}</Text>
                  </View>
                </View>
              )
            }
            return (
              <Text key={ci} style={[s.cell, { flex: col.flex, textAlign: col.align ?? "left" }]}>
                {String(cell)}
              </Text>
            )
          })}
        </View>
      ))}
    </View>
  )
}

// - Report-wide sections (always rendered) -
function ExecutiveSummary({ d }: { d: ReportData }) {
  const e = d.exposure
  return (
    <View style={s.section}>
      <SectionHead title="Executive summary" />
      <View style={s.kpiRow}>
        <Kpi label="Risk score" value={`${e.riskScore}`} foot={e.riskLabel} color={riskColor(e.riskScore)} />
        <Kpi label="Exposure rate" value={`${e.exposureRate}%`} foot={`${num(e.exposedEmployees)} of ${num(e.totalEmployees)} staff`} />
        <Kpi label="Breaches" value={num(e.totalBreaches)} foot="known incidents" />
        <Kpi label="Critical alerts" value={num(e.openAlerts.critical)} foot="open, unresolved" color={e.openAlerts.critical > 0 ? SEVERITY.critical : undefined} />
      </View>
    </View>
  )
}

function Findings({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) return null
  return (
    <View style={s.section} wrap={false}>
      <SectionHead title="Key findings" lead="Automated assessment of the current exposure posture." />
      {findings.map((f, i) => (
        <View key={i} style={s.finding}>
          <Text style={[s.badge, { backgroundColor: SEVERITY[f.severity] }]}>{f.severity === "ok" ? "OK" : f.severity}</Text>
          <Text style={s.findingText}>{f.message}</Text>
        </View>
      ))}
    </View>
  )
}

function changeLine(cur: number, prev: number): { text: string; color: string } {
  const diff = cur - prev
  if (diff === 0) return { text: "no change vs previous", color: C.muted }
  const pct = prev === 0 ? null : Math.round((diff / prev) * 100)
  const sign = diff > 0 ? "+" : ""
  const tail = pct === null ? "" : ` (${sign}${pct}%)`
  // These are adverse counts (new breaches/alerts/exposed), so a rise is bad.
  return { text: `${sign}${num(diff)} vs previous${tail}`, color: diff > 0 ? SEVERITY.high : SEVERITY.ok }
}

function PeriodDeltas({ d }: { d: ReportData }) {
  const dl = d.deltas
  const items = [
    { label: "Newly exposed", v: dl.newlyExposed },
    { label: "New breaches", v: dl.newBreaches },
    { label: "New alerts", v: dl.newAlerts },
  ]
  return (
    <View style={s.section} wrap={false}>
      <SectionHead title="Period activity" lead={`Change over the ${dl.windowLabel} window.`} />
      <View style={s.kpiRow}>
        {items.map((it, i) => {
          const ch = changeLine(it.v.current, it.v.previous)
          return (
            <View key={i} style={s.deltaCard}>
              <Text style={s.deltaLabel}>{it.label}</Text>
              <Text style={s.deltaValue}>{num(it.v.current)}</Text>
              <Text style={[s.deltaChange, { color: ch.color }]}>{ch.text}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

function AlertSeverity({ d }: { d: ReportData }) {
  const a = d.exposure.openAlerts
  const parts: { key: FindingSeverity; label: string; n: number }[] = [
    { key: "critical", label: "Critical", n: a.critical },
    { key: "high", label: "High", n: a.high },
    { key: "medium", label: "Medium", n: a.medium },
    { key: "info", label: "Low", n: a.low },
  ]
  const total = parts.reduce((t, p) => t + p.n, 0)
  if (total === 0) return null
  return (
    <View style={s.section} wrap={false}>
      <SectionHead title="Open alerts by severity" lead={`${num(total)} alerts awaiting action.`} />
      <View style={s.sevBar}>
        {parts.filter((p) => p.n > 0).map((p) => (
          <View key={p.key} style={{ width: `${(p.n / total) * 100}%`, backgroundColor: SEVERITY[p.key] }} />
        ))}
      </View>
      <View style={s.sevLegend}>
        {parts.map((p) => (
          <View key={p.key} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: SEVERITY[p.key] }]} />
            <Text style={s.legendText}>{`${p.label} ${num(p.n)}`}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// - Optional detail tables (gated by `sections`) -
type Block = { title: string; lead?: string; cols: Col[]; rows: Cell[][] }

function detailBlock(section: ReportSection, d: ReportData): Block | null {
  switch (section) {
    case "exposure":
      return {
        title: "Exposure detail",
        cols: [{ label: "Metric", flex: 3 }, { label: "Value", flex: 2, align: "right" }],
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
        cols: [{ label: "Metric", flex: 3 }, { label: "Value", flex: 2, align: "right" }],
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
        lead: "Top categories of leaked records.",
        cols: [{ label: "Data type", flex: 4 }, { label: "Records", flex: 2, align: "right" }, { label: "Share", flex: 3 }],
        rows: d.dataTypes.slice(0, 15).map((t) => [
          t.critical ? `${t.label} (sensitive)` : t.label,
          num(t.count),
          { bar: t.percentage, label: `${t.percentage}%`, color: t.critical ? SEVERITY.critical : C.brand },
        ]),
      }
    case "departments":
      return {
        title: "Departments",
        lead: "Exposure concentration across the organisation.",
        cols: [{ label: "Department", flex: 4 }, { label: "Staff", flex: 2, align: "right" }, { label: "Exposed", flex: 2, align: "right" }, { label: "Rate", flex: 3 }],
        rows: d.departments.map((r) => [
          r.department,
          num(r.total),
          num(r.exposed),
          { bar: r.exposureRate, label: `${r.exposureRate}%`, color: r.exposureRate >= 50 ? SEVERITY.high : C.brand },
        ]),
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
        cols: [{ label: "Month", flex: 4 }, { label: "Breaches", flex: 3, align: "right" }, { label: "Alerts", flex: 3, align: "right" }],
        rows: d.trends.monthly.map((m) => [m.month, num(m.breaches), num(m.alerts)]),
      }
    default:
      return null
  }
}

function DetailSection({ section, d }: { section: ReportSection; d: ReportData }) {
  const b = detailBlock(section, d)
  if (!b) return null
  // Keep the heading glued to a short table so a page break can't strand it; let
  // long tables (and their heading) flow across pages.
  return (
    <View style={s.section} wrap={b.rows.length > 14}>
      <SectionHead title={b.title} lead={b.lead} />
      <Table cols={b.cols} rows={b.rows} />
    </View>
  )
}

// - Document -
const SECTION_ORDER: ReportSection[] = ["exposure", "compliance", "datatypes", "departments", "employees", "trends"]

// Render a professional, multi-section PDF report: a branded cover band, an
// executive KPI summary, key findings, period activity, an alert-severity
// breakdown and the requested detail tables, with a paginated footer. Returns a
// Buffer suitable for an email attachment or an HTTP download.
export function reportPdf(sections: ReportSection[], data: ReportData): Promise<Buffer> {
  const want = new Set(sections)
  const details = SECTION_ORDER.filter((sec) => want.has(sec))
  const generated = new Date(data.generatedAt)

  const doc = (
    <Document title="DataShield security report" author="DataShield" subject="Security exposure report">
      <Page size="A4" style={s.page}>
        <View style={s.band}>
          <View style={s.brandRow}>
            <View>
              <Text style={s.brand}>DataShield</Text>
              <Text style={s.brandSub}>Security Exposure Report</Text>
            </View>
            <Text style={s.confidential}>CONFIDENTIAL</Text>
          </View>
          <Text style={s.bandMeta}>
            {`Generated ${generated.toUTCString()}  |  Reporting window ${data.deltas.windowLabel}`}
          </Text>
        </View>

        <ExecutiveSummary d={data} />
        <Findings findings={data.findings} />
        <PeriodDeltas d={data} />
        <AlertSeverity d={data} />

        {details.map((sec) => (
          <DetailSection key={sec} section={sec} d={data} />
        ))}

        <View style={s.footer} fixed>
          <Text style={s.footText}>DataShield - confidential security report</Text>
          <Text style={s.footText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )

  return renderToBuffer(doc)
}
