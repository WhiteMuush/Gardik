import type { RiskLevel } from "@/lib/employees"

export type SeverityCounts = {
  critical: number
  high: number
  medium: number
  low: number
}

export type TopBreach = {
  name: string
  source: string
  breachDate: string
  affectedEmployees: number
}

export type ExposureSummary = {
  totalEmployees: number
  exposedEmployees: number
  exposureRate: number
  totalBreaches: number
  openAlerts: SeverityCounts
  riskScore: number
  riskLabel: string
  topBreaches: TopBreach[]
}

export type EmployeeReportRow = {
  name: string
  email: string
  department: string | null
  breachCount: number
  exposedDataTypes: string[]
  lastDetectedAt: string | null
  riskScore: number
  riskLevel: RiskLevel
}

export type MonthlyPoint = {
  month: string
  breaches: number
  alerts: number
}

export type Trends = {
  monthly: MonthlyPoint[]
}

export type ComplianceSummary = {
  monitoredEmployees: number
  exposedEmployees: number
  exposureRate: number
  alertsTotal: number
  alertsOpen: number
  alertsAcknowledged: number
  alertsResolved: number
  resolutionRate: number
  criticalOpen: number
  staleCriticalOpen: number
}

export type DataTypeExposure = {
  type: string
  label: string
  count: number
  percentage: number
  critical: boolean
}

export type DepartmentRow = {
  department: string
  total: number
  exposed: number
  exposureRate: number
}

export type FindingSeverity = "critical" | "high" | "medium" | "info" | "ok"

export type Finding = {
  severity: FindingSeverity
  message: string
}

export type Delta = {
  current: number
  previous: number
}

export type ReportDeltas = {
  windowLabel: string
  newlyExposed: Delta
  newBreaches: Delta
  newAlerts: Delta
}

export type ReportData = {
  generatedAt: string
  findings: Finding[]
  exposure: ExposureSummary
  dataTypes: DataTypeExposure[]
  departments: DepartmentRow[]
  employees: EmployeeReportRow[]
  trends: Trends
  compliance: ComplianceSummary
  deltas: ReportDeltas
}
