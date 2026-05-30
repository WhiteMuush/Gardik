import { auth } from "@/auth"
import { getDashboardData, getRiskLevel } from "@/lib/dashboard"
import { StatCard } from "@/components/dashboard/StatCard"
import { TrendChart } from "@/components/dashboard/TrendChart"
import { DataTypeBreakdown } from "@/components/dashboard/DataTypeBreakdown"
import { Users, Bell, Database, ShieldAlert } from "lucide-react"

export default async function DashboardPage() {
  const session = await auth()
  const data = await getDashboardData(session!.user.companyId)
  const risk = getRiskLevel(data.riskScore)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Employees at risk"
          value={data.compromisedEmployees}
          description={`out of ${data.totalEmployees} monitored`}
          icon={Users}
          variant={data.compromisedEmployees > 0 ? "critical" : "ok"}
        />
        <StatCard
          label="Active alerts"
          value={data.openAlerts}
          description="requiring attention"
          icon={Bell}
          variant={data.openAlerts > 0 ? "high" : "ok"}
        />
        <StatCard
          label="New detections"
          value={data.recentBreaches}
          description="in the last 30 days"
          icon={Database}
          variant={data.recentBreaches > 0 ? "medium" : "ok"}
        />
        <StatCard
          label="Risk score"
          value={`${data.riskScore} / 100`}
          description={risk.label}
          icon={ShieldAlert}
          variant={risk.variant}
        />
      </div>

      <TrendChart data={data.trendData} />

      <DataTypeBreakdown data={data.dataTypes} />
    </div>
  )
}
