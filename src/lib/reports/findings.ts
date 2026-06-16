import { plural } from "./utils"
import type {
  ComplianceSummary,
  DataTypeExposure,
  ExposureSummary,
  Finding,
  ReportDeltas,
} from "./types"

const ORDER: Record<Finding["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  info: 3,
  ok: 4,
}

function alertFindings(c: ComplianceSummary): Finding[] {
  const out: Finding[] = []
  if (c.criticalOpen > 0)
    out.push({
      severity: "critical",
      message: `${plural(c.criticalOpen, "critical alert")} open and requiring immediate action.`,
    })
  if (c.staleCriticalOpen > 0)
    out.push({
      severity: "critical",
      message: `${plural(c.staleCriticalOpen, "critical alert")} open for more than 30 days.`,
    })
  if (c.alertsTotal >= 10 && c.resolutionRate < 50)
    out.push({
      severity: "medium",
      message: `Only ${c.resolutionRate}% of all alerts have been resolved so far.`,
    })
  return out
}

function exposureFindings(e: ExposureSummary): Finding[] {
  if (e.exposedEmployees === 0)
    return [
      {
        severity: "ok",
        message: `No breach exposure detected across ${plural(e.totalEmployees, "monitored employee")}.`,
      },
    ]

  const out: Finding[] = []
  if (e.exposureRate >= 50)
    out.push({
      severity: "high",
      message: `${e.exposureRate}% of the workforce appears in at least one known breach.`,
    })
  else if (e.exposureRate >= 25)
    out.push({
      severity: "medium",
      message: `${e.exposureRate}% of the workforce appears in at least one known breach.`,
    })

  const top = e.topBreaches[0]
  if (top)
    out.push({
      severity: "info",
      message: `"${top.name}" is the largest single source of exposure, affecting ${plural(top.affectedEmployees, "employee")}.`,
    })
  return out
}

function dataFindings(types: DataTypeExposure[]): Finding[] {
  const sensitive = types.filter((t) => t.critical && t.count > 0)
  if (sensitive.length === 0) return []

  const out: Finding[] = []
  const passwords = sensitive.find((t) => t.type.toLowerCase() === "password")
  if (passwords)
    out.push({
      severity: "high",
      message: `Passwords are exposed in ${plural(passwords.count, "breach record")}. Enforce resets for the affected accounts.`,
    })

  const others = sensitive.filter((t) => t !== passwords).slice(0, 3)
  if (others.length > 0)
    out.push({
      severity: "high",
      message: `Sensitive data exposed: ${others.map((t) => `${t.label} (${t.count})`).join(", ")}.`,
    })
  return out
}

function trendWord(current: number, previous: number): string {
  if (current > previous) return `up from ${previous}`
  if (current < previous) return `down from ${previous}`
  return `unchanged from ${previous}`
}

function deltaFindings(d: ReportDeltas): Finding[] {
  const out: Finding[] = []
  const { newlyExposed, newBreaches } = d

  if (newlyExposed.current > 0)
    out.push({
      severity: newlyExposed.current > newlyExposed.previous ? "high" : "medium",
      message: `${plural(newlyExposed.current, "employee")} newly exposed in the latest period (${trendWord(newlyExposed.current, newlyExposed.previous)}).`,
    })

  if (newBreaches.current > 0)
    out.push({
      severity: newBreaches.current > newBreaches.previous ? "medium" : "info",
      message: `${plural(newBreaches.current, "breach")} with new detections in the latest period (${trendWord(newBreaches.current, newBreaches.previous)}).`,
    })

  return out
}

export function buildFindings(
  exposure: ExposureSummary,
  compliance: ComplianceSummary,
  dataTypes: DataTypeExposure[],
  deltas: ReportDeltas
): Finding[] {
  return [
    ...alertFindings(compliance),
    ...exposureFindings(exposure),
    ...dataFindings(dataTypes),
    ...deltaFindings(deltas),
  ].sort((a, b) => ORDER[a.severity] - ORDER[b.severity])
}
