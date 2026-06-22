export function calculateRiskScore({
  totalEmployees,
  compromisedEmployees,
  criticalAlerts,
  highAlerts,
  mediumAlerts,
  recentBreaches,
}: {
  totalEmployees: number
  compromisedEmployees: number
  criticalAlerts: number
  highAlerts: number
  mediumAlerts: number
  recentBreaches: number
}): number {
  if (totalEmployees === 0) return 0
  const exposureScore = (compromisedEmployees / totalEmployees) * 40
  const alertScore = Math.min(criticalAlerts * 12 + highAlerts * 6 + mediumAlerts * 2, 40)
  const recencyScore = Math.min(recentBreaches * 4, 20)
  return Math.min(Math.round(exposureScore + alertScore + recencyScore), 100)
}

// Data types that make an exposure materially worse for a single employee.
export const CRITICAL_DATA = ["password", "credit_card", "ssn", "bank_account", "financial"]

// Stealer-log artifacts that hand an attacker a ready-to-replay session,
// bypassing MFA. Their presence dominates a per-employee score.
const SESSION_ARTIFACTS = ["COOKIE", "TOKEN"]

// How long a recent exposure keeps weighing on the recency component, in days.
const RECENCY_WINDOW_DAYS = 180

// Per-employee risk weights. Configurable per company; every component caps the
// points it can add so a single signal cannot alone pin the score at 100.
export type RiskWeights = {
  recency: number
  session: number
  criticalData: number
  domainMatch: number
  openAlerts: number
  breaches: number
}

export const DEFAULT_RISK_WEIGHTS: RiskWeights = {
  recency: 25,
  session: 30,
  criticalData: 20,
  domainMatch: 15,
  openAlerts: 10,
  breaches: 10,
}

// Merge a stored (untrusted) weight override onto the defaults, keeping only
// finite non-negative numbers for known keys.
export function resolveRiskWeights(stored: unknown): RiskWeights {
  if (!stored || typeof stored !== "object") return DEFAULT_RISK_WEIGHTS
  const out = { ...DEFAULT_RISK_WEIGHTS }
  for (const key of Object.keys(DEFAULT_RISK_WEIGHTS) as (keyof RiskWeights)[]) {
    const v = (stored as Record<string, unknown>)[key]
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[key] = v
  }
  return out
}

export type EmployeeRiskInput = {
  breachCount: number
  recencyDays: number | null // days since most recent detection; null if never exposed
  hasSessionArtifact: boolean
  hasCriticalData: boolean
  domainMatch: boolean
  openAlerts: number
}

const DAY_MS = 24 * 60 * 60 * 1000

// Derive the scoring inputs from an employee's raw breach records and alerts.
export function buildEmployeeRiskInput(params: {
  email: string
  companyDomain: string
  records: { detectedAt: Date; exposedData: string[]; artifacts: string[] }[]
  openAlerts: number
  now?: Date
}): EmployeeRiskInput {
  const { records } = params
  const now = params.now ?? new Date()
  const latest = records.reduce<Date | null>(
    (max, r) => (max === null || r.detectedAt > max ? r.detectedAt : max),
    null
  )
  const domain = params.email.split("@")[1]?.toLowerCase() ?? ""
  return {
    breachCount: records.length,
    recencyDays: latest ? Math.max(0, Math.floor((now.getTime() - latest.getTime()) / DAY_MS)) : null,
    hasSessionArtifact: records.some((r) => r.artifacts.some((a) => SESSION_ARTIFACTS.includes(a))),
    hasCriticalData: records.some((r) => r.exposedData.some((d) => CRITICAL_DATA.includes(d.toLowerCase()))),
    domainMatch: domain.length > 0 && domain === params.companyDomain.toLowerCase(),
    openAlerts: params.openAlerts,
  }
}

// Per-employee risk score, 0-100. A score of 0 means no known exposure.
export function employeeRiskScore(i: EmployeeRiskInput, w: RiskWeights = DEFAULT_RISK_WEIGHTS): number {
  if (i.breachCount === 0) return 0
  let s = 0
  if (i.recencyDays !== null) {
    s += w.recency * Math.max(0, Math.min(1, 1 - i.recencyDays / RECENCY_WINDOW_DAYS))
  }
  if (i.hasSessionArtifact) s += w.session
  if (i.hasCriticalData) s += w.criticalData
  if (i.domainMatch) s += w.domainMatch
  s += (Math.min(i.openAlerts, 3) / 3) * w.openAlerts
  s += (Math.min(i.breachCount, 5) / 5) * w.breaches
  return Math.min(100, Math.round(s))
}

export function getRiskLevel(score: number): {
  level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  label: string
  variant: "critical" | "high" | "medium" | "ok"
} {
  if (score >= 76) return { level: "CRITICAL", label: "Critical risk", variant: "critical" }
  if (score >= 51) return { level: "HIGH", label: "High risk", variant: "high" }
  if (score >= 26) return { level: "MEDIUM", label: "Medium risk", variant: "medium" }
  return { level: "LOW", label: "Low risk", variant: "ok" }
}
