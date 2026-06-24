import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer"
import type { ReportData, Finding, FindingSeverity } from "./types"
import type { ReportSection } from "./html"

// - Palette (DataShield brand: violet primary, orange accent, warm cream) -
const C = {
  brand: "#7F27FF", // primary violet
  brandDark: "#1B1037", // deep violet (cover band, headings)
  brandSoft: "#C4A8FF", // light violet (on dark)
  orange: "#FF8911", // accent
  cream: "#FFF5E5", // warm page background
  ink: "#18122B",
  body: "#2B2440",
  muted: "#6B6480",
  faint: "#9A93AD",
  border: "#E7E0F0",
  zebra: "#FAF7FF",
  head: "#F3EDFF",
  white: "#ffffff",
}

// Severity colours mirror the app's --severity-* tokens (oklch) as hex.
const SEVERITY: Record<FindingSeverity, string> = {
  critical: "#E03131",
  high: "#FF8911",
  medium: "#E8A20C",
  info: "#7F27FF",
  ok: "#1FA45B",
}

function riskColor(score: number): string {
  if (score >= 76) return SEVERITY.critical
  if (score >= 51) return SEVERITY.high
  if (score >= 26) return SEVERITY.medium
  return SEVERITY.ok
}

// - Formatting helpers -
const nf = new Intl.NumberFormat("en-US")
const num = (v: number) => nf.format(v)
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
const were = (n: number) => (n === 1 ? "was" : "were")

function longDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d)
}
const stamp = (iso: string) => new Date(iso).toUTCString()

// - Styles -
const s = StyleSheet.create({
  // Cover page
  coverPage: { fontFamily: "Helvetica", color: C.ink, backgroundColor: C.cream },
  coverBand: { backgroundColor: C.brandDark, paddingHorizontal: 48, paddingTop: 70, paddingBottom: 44 },
  coverAccent: { width: 46, height: 4, backgroundColor: C.orange, borderRadius: 2, marginBottom: 18 },
  coverKicker: { fontSize: 10, color: C.brandSoft, fontFamily: "Helvetica-Bold", letterSpacing: 3 },
  coverOrg: { fontSize: 30, color: C.white, fontFamily: "Helvetica-Bold", marginTop: 12, lineHeight: 1.1 },
  coverDomain: { fontSize: 12, color: C.brandSoft, marginTop: 8 },
  coverBody: { paddingHorizontal: 48, paddingTop: 40, flexGrow: 1 },
  metaTable: { borderTopWidth: 1, borderTopColor: C.border },
  metaRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 10 },
  metaKey: { width: 160, fontSize: 9.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  metaVal: { flex: 1, fontSize: 11, color: C.ink, fontFamily: "Helvetica-Bold" },
  coverFoot: { paddingHorizontal: 48, paddingBottom: 40 },
  coverFootText: { fontSize: 8.5, color: C.muted, lineHeight: 1.5 },
  coverFootRule: { borderTopWidth: 2, borderTopColor: C.brand, width: 60, marginBottom: 10 },

  // Content pages
  page: { paddingTop: 60, paddingBottom: 54, paddingHorizontal: 48, fontSize: 10, color: C.body, fontFamily: "Helvetica" },
  runHead: { position: "absolute", top: 24, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 6 },
  runHeadOrg: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.brandDark },
  runHeadDoc: { fontSize: 8.5, color: C.muted },

  section: { marginTop: 18 },
  sectionHead: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  accent: { width: 3, height: 13, backgroundColor: C.brand, marginRight: 8, borderRadius: 2 },
  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.brandDark },
  lead: { fontSize: 9, color: C.muted, marginBottom: 6 },

  // Narrative prose
  para: { fontSize: 10, lineHeight: 1.5, color: C.body, marginBottom: 6, textAlign: "justify" },
  strong: { fontFamily: "Helvetica-Bold", color: C.ink },

  // Findings
  finding: { flexDirection: "row", alignItems: "flex-start", marginBottom: 5 },
  findingText: { flex: 1, fontSize: 10, lineHeight: 1.4 },
  badge: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: C.white, borderRadius: 2, paddingVertical: 1.5, paddingHorizontal: 5, marginRight: 8, marginTop: 1, textTransform: "uppercase" },

  // Tables
  table: { borderWidth: 1, borderColor: C.border, borderRadius: 4 },
  headRow: { flexDirection: "row", backgroundColor: C.head },
  row: { flexDirection: "row", borderTopWidth: 1, borderTopColor: C.border },
  rowZebra: { backgroundColor: C.zebra },
  headCell: { paddingVertical: 5, paddingHorizontal: 6, fontFamily: "Helvetica-Bold", fontSize: 8, color: C.brandDark },
  cell: { paddingVertical: 5, paddingHorizontal: 6, fontSize: 8.5, color: C.body },
  empty: { fontSize: 9, color: C.faint },

  // Footer
  footer: { position: "absolute", bottom: 26, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.border, paddingTop: 6 },
  footText: { fontSize: 7.5, color: C.faint },
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

type Col = { label: string; flex: number; align?: "left" | "right" }

function Table({ cols, rows }: { cols: Col[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return <Text style={s.empty}>No records for this period.</Text>
  return (
    <View style={s.table} wrap={rows.length > 16}>
      <View style={s.headRow}>
        {cols.map((c, i) => (
          <Text key={i} style={[s.headCell, { flex: c.flex, textAlign: c.align ?? "left" }]}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={[s.row, ri % 2 === 1 ? s.rowZebra : {}]} wrap={false}>
          {row.map((cell, ci) => (
            <Text key={ci} style={[s.cell, { flex: cols[ci].flex, textAlign: cols[ci].align ?? "left" }]}>
              {String(cell)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}

// - Cover page -
function Cover({ d }: { d: ReportData }) {
  return (
    <Page size="A4" style={s.coverPage}>
      <View style={s.coverBand}>
        <View style={s.coverAccent} />
        <Text style={s.coverKicker}>SECURITY EXPOSURE REPORT</Text>
        <Text style={s.coverOrg}>{d.org.name}</Text>
        {d.org.domain ? <Text style={s.coverDomain}>{d.org.domain}</Text> : null}
      </View>
      <View style={s.coverBody}>
        <View style={s.metaTable}>
          <View style={s.metaRow}>
            <Text style={s.metaKey}>Reporting period</Text>
            <Text style={s.metaVal}>{d.deltas.windowLabel}</Text>
          </View>
          <View style={s.metaRow}>
            <Text style={s.metaKey}>Date generated</Text>
            <Text style={s.metaVal}>{longDate(d.generatedAt)}</Text>
          </View>
          <View style={s.metaRow}>
            <Text style={s.metaKey}>Overall risk score</Text>
            <Text style={[s.metaVal, { color: riskColor(d.exposure.riskScore) }]}>
              {`${d.exposure.riskScore} / 100  (${d.exposure.riskLabel})`}
            </Text>
          </View>
          <View style={s.metaRow}>
            <Text style={s.metaKey}>Classification</Text>
            <Text style={s.metaVal}>Confidential</Text>
          </View>
        </View>
      </View>
      <View style={s.coverFoot}>
        <View style={s.coverFootRule} />
        <Text style={s.coverFootText}>
          {`Confidential. This document contains security information intended solely for ${d.org.name}.`}
        </Text>
        <Text style={s.coverFootText}>{`Generated ${stamp(d.generatedAt)} by DataShield.`}</Text>
      </View>
    </Page>
  )
}

// - Narrative sections (information-led) -
function ExecutiveOverview({ d }: { d: ReportData }) {
  const e = d.exposure
  const c = d.compliance
  const critical = e.openAlerts.critical
  return (
    <View style={s.section}>
      <SectionHead title="Executive overview" />
      <Text style={s.para}>
        <Text style={s.strong}>{`${num(e.exposedEmployees)} of ${num(e.totalEmployees)} `}</Text>
        {`monitored ${plural(e.totalEmployees, "employee", "employees")} (${e.exposureRate}%) ${were(e.exposedEmployees)} found in at least one known data breach. A total of `}
        <Text style={s.strong}>{`${num(e.totalBreaches)} ${plural(e.totalBreaches, "breach", "breaches")} `}</Text>
        {`${were(e.totalBreaches)} recorded against the organisation. The overall risk score stands at `}
        <Text style={[s.strong, { color: riskColor(e.riskScore) }]}>{`${e.riskScore} out of 100 (${e.riskLabel})`}</Text>
        {"."}
      </Text>
      <Text style={s.para}>
        {critical > 0
          ? `${num(critical)} critical ${plural(critical, "alert", "alerts")} remain open and require immediate attention. `
          : "No critical alerts are currently open. "}
        {`Of ${num(c.alertsTotal)} alerts raised in total, ${num(c.alertsResolved)} (${c.resolutionRate}%) have been resolved, with ${num(c.alertsOpen)} still open${c.staleCriticalOpen > 0 ? `, including ${num(c.staleCriticalOpen)} critical ${plural(c.staleCriticalOpen, "alert", "alerts")} open for more than seven days` : ""}.`}
      </Text>
    </View>
  )
}

function KeyFindings({ findings }: { findings: Finding[] }) {
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

function changePhrase(cur: number, prev: number): string {
  const diff = cur - prev
  if (diff === 0) return "unchanged from the previous period"
  const dir = diff > 0 ? "up" : "down"
  const pct = prev === 0 ? null : Math.abs(Math.round((diff / prev) * 100))
  return pct === null ? `${dir} from ${num(prev)}` : `${dir} ${pct}% from ${num(prev)}`
}

function PeriodActivity({ d }: { d: ReportData }) {
  const dl = d.deltas
  return (
    <View style={s.section} wrap={false}>
      <SectionHead title="What changed this period" lead={`Activity across the ${dl.windowLabel} reporting window.`} />
      <Text style={s.para}>
        {`During this window, `}
        <Text style={s.strong}>{`${num(dl.newlyExposed.current)} ${plural(dl.newlyExposed.current, "employee", "employees")}`}</Text>
        {` ${were(dl.newlyExposed.current)} newly exposed (${changePhrase(dl.newlyExposed.current, dl.newlyExposed.previous)}), `}
        <Text style={s.strong}>{`${num(dl.newBreaches.current)} new ${plural(dl.newBreaches.current, "breach", "breaches")}`}</Text>
        {` ${were(dl.newBreaches.current)} detected (${changePhrase(dl.newBreaches.current, dl.newBreaches.previous)}), and `}
        <Text style={s.strong}>{`${num(dl.newAlerts.current)} ${plural(dl.newAlerts.current, "alert", "alerts")}`}</Text>
        {` ${were(dl.newAlerts.current)} raised (${changePhrase(dl.newAlerts.current, dl.newAlerts.previous)}).`}
      </Text>
      <Table
        cols={[
          { label: "Activity", flex: 4 },
          { label: "This period", flex: 2, align: "right" },
          { label: "Previous", flex: 2, align: "right" },
        ]}
        rows={[
          ["Newly exposed employees", num(dl.newlyExposed.current), num(dl.newlyExposed.previous)],
          ["New breaches detected", num(dl.newBreaches.current), num(dl.newBreaches.previous)],
          ["New alerts raised", num(dl.newAlerts.current), num(dl.newAlerts.previous)],
        ]}
      />
    </View>
  )
}

function NotableIncidents({ d }: { d: ReportData }) {
  const breaches = d.exposure.topBreaches
  if (breaches.length === 0) return null
  return (
    <View style={s.section}>
      <SectionHead title="Notable incidents" lead="Breaches with the greatest impact on the organisation." />
      <Table
        cols={[
          { label: "Breach", flex: 4 },
          { label: "Source", flex: 3 },
          { label: "Date", flex: 3 },
          { label: "Affected", flex: 2, align: "right" },
        ]}
        rows={breaches.slice(0, 12).map((b) => [b.name, b.source, longDate(b.breachDate), num(b.affectedEmployees)])}
      />
    </View>
  )
}

function AlertBreakdown({ d }: { d: ReportData }) {
  const a = d.exposure.openAlerts
  const total = a.critical + a.high + a.medium + a.low
  if (total === 0) return null
  const share = (n: number) => `${Math.round((n / total) * 100)}%`
  return (
    <View style={s.section} wrap={false}>
      <SectionHead title="Open alerts by severity" lead={`${num(total)} alerts awaiting action.`} />
      <Table
        cols={[
          { label: "Severity", flex: 4 },
          { label: "Open alerts", flex: 2, align: "right" },
          { label: "Share", flex: 2, align: "right" },
        ]}
        rows={[
          ["Critical", num(a.critical), share(a.critical)],
          ["High", num(a.high), share(a.high)],
          ["Medium", num(a.medium), share(a.medium)],
          ["Low", num(a.low), share(a.low)],
        ]}
      />
    </View>
  )
}

// - Detail tables (gated by `sections`) -
type Block = { title: string; lead?: string; cols: Col[]; rows: (string | number)[][] }

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
        lead: "Categories of leaked records, most exposed first.",
        cols: [{ label: "Data type", flex: 5 }, { label: "Records", flex: 2, align: "right" }, { label: "Share", flex: 2, align: "right" }],
        rows: d.dataTypes.slice(0, 15).map((t) => [
          t.critical ? `${t.label} (sensitive)` : t.label,
          num(t.count),
          `${t.percentage}%`,
        ]),
      }
    case "departments":
      return {
        title: "Departments",
        lead: "Exposure concentration across the organisation.",
        cols: [{ label: "Department", flex: 5 }, { label: "Staff", flex: 2, align: "right" }, { label: "Exposed", flex: 2, align: "right" }, { label: "Rate", flex: 2, align: "right" }],
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
    <View style={s.section} wrap={b.rows.length > 16}>
      <SectionHead title={b.title} lead={b.lead} />
      <Table cols={b.cols} rows={b.rows} />
    </View>
  )
}

// - Document -
const SECTION_ORDER: ReportSection[] = ["exposure", "compliance", "datatypes", "departments", "employees", "trends"]

// Render a professional, multi-page PDF report: a dedicated cover page naming the
// organisation, followed by information-led content (executive narrative, key
// findings, period activity, notable incidents, alert breakdown) and the
// requested detail tables. Running header and paginated footer on content pages.
// Returns a Buffer suitable for an email attachment or an HTTP download.
export function reportPdf(sections: ReportSection[], data: ReportData): Promise<Buffer> {
  const want = new Set(sections)
  const details = SECTION_ORDER.filter((sec) => want.has(sec))

  const doc = (
    <Document title={`DataShield report - ${data.org.name}`} author="DataShield" subject="Security exposure report">
      <Cover d={data} />

      <Page size="A4" style={s.page}>
        <View style={s.runHead} fixed>
          <Text style={s.runHeadOrg}>{data.org.name}</Text>
          <Text style={s.runHeadDoc}>Security Exposure Report</Text>
        </View>

        <ExecutiveOverview d={data} />
        <KeyFindings findings={data.findings} />
        <PeriodActivity d={data} />
        <NotableIncidents d={data} />
        <AlertBreakdown d={data} />

        {details.map((sec) => (
          <DetailSection key={sec} section={sec} d={data} />
        ))}

        <View style={s.footer} fixed>
          <Text style={s.footText}>{`${data.org.name} - confidential`}</Text>
          <Text style={s.footText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )

  return renderToBuffer(doc)
}
