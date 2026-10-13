import { Text, View } from "@react-pdf/renderer"
import type { Finding, ReportData } from "../types"
import { SEVERITY, num, plural, riskColor, s, were, longDate } from "./theme"
import { SectionHead, Table } from "./blocks"

// - Narrative sections (information-led) -
export function ExecutiveOverview({ d }: { d: ReportData }) {
  const e = d.exposure
  const c = d.compliance
  const critical = e.openAlerts.critical
  return (
    <View style={s.section}>
      <SectionHead title="Executive overview" />
      <Text style={s.para}>
        <Text style={s.strong}>{`${num(e.exposedEmployees)} of ${num(e.totalEmployees)} `}</Text>
        {`monitored ${plural(e.totalEmployees, "employee", "employees")} (${e.exposureRate}%) ${were(e.exposedEmployees)} found in at least one known data breach. A total of `}
        <Text
          style={s.strong}
        >{`${num(e.totalBreaches)} ${plural(e.totalBreaches, "breach", "breaches")} `}</Text>
        {`${were(e.totalBreaches)} recorded against the organisation. The overall risk score stands at `}
        <Text
          style={[s.strong, { color: riskColor(e.riskScore) }]}
        >{`${e.riskScore} out of 100 (${e.riskLabel})`}</Text>
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

export function KeyFindings({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) return null
  return (
    <View style={s.section} wrap={false}>
      <SectionHead title="Key findings" lead="Automated assessment of the current exposure posture." />
      {findings.map((f, i) => (
        <View key={i} style={s.finding}>
          <Text style={[s.badge, { backgroundColor: SEVERITY[f.severity] }]}>
            {f.severity === "ok" ? "OK" : f.severity}
          </Text>
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

export function PeriodActivity({ d }: { d: ReportData }) {
  const dl = d.deltas
  return (
    <View style={s.section} wrap={false}>
      <SectionHead
        title="What changed this period"
        lead={`Activity across the ${dl.windowLabel} reporting window.`}
      />
      <Text style={s.para}>
        {`During this window, `}
        <Text
          style={s.strong}
        >{`${num(dl.newlyExposed.current)} ${plural(dl.newlyExposed.current, "employee", "employees")}`}</Text>
        {` ${were(dl.newlyExposed.current)} newly exposed (${changePhrase(dl.newlyExposed.current, dl.newlyExposed.previous)}), `}
        <Text
          style={s.strong}
        >{`${num(dl.newBreaches.current)} new ${plural(dl.newBreaches.current, "breach", "breaches")}`}</Text>
        {` ${were(dl.newBreaches.current)} detected (${changePhrase(dl.newBreaches.current, dl.newBreaches.previous)}), and `}
        <Text
          style={s.strong}
        >{`${num(dl.newAlerts.current)} ${plural(dl.newAlerts.current, "alert", "alerts")}`}</Text>
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

export function NotableIncidents({ d }: { d: ReportData }) {
  const breaches = d.exposure.topBreaches
  if (breaches.length === 0) return null
  return (
    <View style={s.section} wrap={breaches.length > 12}>
      <SectionHead title="Notable incidents" lead="Breaches with the greatest impact on the organisation." />
      <Table
        cols={[
          { label: "Breach", flex: 4 },
          { label: "Source", flex: 3 },
          { label: "Date", flex: 3 },
          { label: "Affected", flex: 2, align: "right" },
        ]}
        rows={breaches
          .slice(0, 12)
          .map((b) => [b.name, b.source, longDate(b.breachDate), num(b.affectedEmployees)])}
      />
    </View>
  )
}

export function AlertBreakdown({ d }: { d: ReportData }) {
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
