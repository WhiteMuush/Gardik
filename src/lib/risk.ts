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
