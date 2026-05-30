import { auth } from "@/auth"
import { getDashboardData } from "@/lib/dashboard"
import { StatsRow } from "@/components/dashboard/StatsRow"
import { TrendChart } from "@/components/dashboard/TrendChart"
import { DataTypeBreakdown } from "@/components/dashboard/DataTypeBreakdown"

export default async function DashboardPage() {
  const session = await auth()
  const data = await getDashboardData(session!.user.companyId)

  return (
    <div className="space-y-6">
      <StatsRow {...data} />
      <TrendChart data={data.trendData} />
      <DataTypeBreakdown data={data.dataTypes} />
    </div>
  )
}
