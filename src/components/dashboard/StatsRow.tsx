import { StatCard } from "@/components/dashboard/StatCard"
import { getRiskLevel } from "@/lib/dashboard"
import { Users, Bell, Database, ShieldAlert } from "lucide-react"

interface StatsRowProps {
  compromisedEmployees: number
  totalEmployees: number
  openAlerts: number
  recentBreaches: number
  riskScore: number
}

export function StatsRow({
  compromisedEmployees,
  totalEmployees,
  openAlerts,
  recentBreaches,
  riskScore,
}: StatsRowProps) {
  const risk = getRiskLevel(riskScore)

  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard
        label="Employees at risk"
        value={compromisedEmployees}
        description={`out of ${totalEmployees} monitored`}
        icon={Users}
        variant={compromisedEmployees > 0 ? "critical" : "ok"}
      />
      <StatCard
        label="Active alerts"
        value={openAlerts}
        description="requiring attention"
        icon={Bell}
        variant={openAlerts > 0 ? "high" : "ok"}
      />
      <StatCard
        label="New detections"
        value={recentBreaches}
        description="in the last 30 days"
        icon={Database}
        variant={recentBreaches > 0 ? "medium" : "ok"}
      />
      <StatCard
        label="Risk score"
        value={`${riskScore} / 100`}
        description={risk.label}
        icon={ShieldAlert}
        variant={risk.variant}
      />
    </div>
  )
}
