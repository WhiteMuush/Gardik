import { buildEmployeeRiskInput, employeeRiskScore, getRiskLevel, type RiskWeights } from "@/lib/risk"

type EmployeeRaw = {
  id: string
  firstName: string
  lastName: string
  department: string | null
  email: string
  breachRecords: { detectedAt: Date; exposedData: string[]; artifacts: string[] }[]
  alerts: { severity: string }[]
}

export function buildTopRiskyEmployees(
  employees: EmployeeRaw[],
  companyDomain: string,
  weights: RiskWeights
) {
  return employees
    .map((e) => {
      const score = employeeRiskScore(
        buildEmployeeRiskInput({
          email: e.email,
          companyDomain,
          records: e.breachRecords,
          openAlerts: e.alerts.length,
        }),
        weights
      )
      return {
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        department: e.department,
        breachCount: e.breachRecords.length,
        openAlerts: e.alerts.length,
        riskScore: score,
        riskLevel: getRiskLevel(score).label,
        riskVariant: getRiskLevel(score).variant,
      }
    })
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 8)
}

export function buildDepartmentRisk(
  employees: { department: string | null; breachRecords: { id: string }[] }[]
) {
  const depts: Record<string, { total: number; compromised: number }> = {}

  employees.forEach(({ department, breachRecords }) => {
    const dept = department ?? "Unknown"
    if (!depts[dept]) depts[dept] = { total: 0, compromised: 0 }
    depts[dept].total++
    if (breachRecords.length > 0) depts[dept].compromised++
  })

  return Object.entries(depts)
    .map(([dept, { total, compromised }]) => ({
      department: dept,
      total,
      compromised,
      percentage: total > 0 ? Math.round((compromised / total) * 100) : 0,
    }))
    .sort((a, b) => b.compromised - a.compromised)
    .slice(0, 8)
}

export function buildAlertsByMonth(alerts: { createdAt: Date; severity: string }[]) {
  const months: Record<
    string,
    { month: string; critical: number; high: number; medium: number; low: number }
  > = {}

  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = d.toLocaleString("en-US", { month: "short", year: "2-digit" })
    months[key] = { month: key, critical: 0, high: 0, medium: 0, low: 0 }
  }

  alerts.forEach(({ createdAt, severity }) => {
    const key = new Date(createdAt).toLocaleString("en-US", { month: "short", year: "2-digit" })
    if (!(key in months)) return
    const s = severity.toLowerCase() as "critical" | "high" | "medium" | "low"
    if (s in months[key]) months[key][s]++
  })

  return Object.values(months)
}

export function buildAlertsByDepartment(
  alerts: { severity: string; employee: { department: string | null } | null }[]
) {
  const depts: Record<
    string,
    { critical: number; high: number; medium: number; low: number; total: number }
  > = {}

  alerts.forEach(({ severity, employee }) => {
    const dept = employee?.department ?? "Unknown"
    if (!depts[dept]) depts[dept] = { critical: 0, high: 0, medium: 0, low: 0, total: 0 }
    depts[dept].total++
    const s = severity.toLowerCase() as "critical" | "high" | "medium" | "low"
    if (s in depts[dept]) depts[dept][s]++
  })

  return Object.entries(depts)
    .map(([department, counts]) => ({ department, ...counts }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
}

export function buildEmployeeExposureLevels(employees: { breachRecords: { id: string }[] }[]) {
  return employees.reduce(
    (acc, e) => {
      if (e.breachRecords.length === 0) acc.none++
      else if (e.breachRecords.length === 1) acc.one++
      else acc.multiple++
      return acc
    },
    { none: 0, one: 0, multiple: 0 }
  )
}

export function buildAlertVelocity(alerts: { createdAt: Date }[]) {
  const days: Record<string, number> = {}

  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    days[key] = 0
  }

  alerts.forEach(({ createdAt }) => {
    const key = new Date(createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    if (key in days) days[key]++
  })

  return Object.entries(days).map(([day, count]) => ({ day, count }))
}
