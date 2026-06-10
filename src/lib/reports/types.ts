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
}

export type ReportData = {
  generatedAt: string
  exposure: ExposureSummary
  employees: EmployeeReportRow[]
  trends: Trends
  compliance: ComplianceSummary
}
