import { auth } from "@/auth"
import { getDashboardData } from "@/lib/dashboard"
import { DashboardCanvas } from "@/components/dashboard/DashboardCanvas"
import { StatsRow } from "@/components/dashboard/StatsRow"
import { TrendChart } from "@/components/dashboard/TrendChart"
import { DataTypeBreakdown } from "@/components/dashboard/DataTypeBreakdown"

export default async function DashboardPage() {
  const session = await auth()
  const data = await getDashboardData(session!.user.companyId)

  const sections = [
    {
      id: "stats",
      label: "Statistics",
      content: <StatsRow {...data} />,
    },
    {
      id: "timeline",
      label: "Incident Timeline",
      content: <TrendChart data={data.trendData} />,
    },
    {
      id: "breakdown",
      label: "Data Type Breakdown",
      content: <DataTypeBreakdown data={data.dataTypes} />,
    },
  ]

  return <DashboardCanvas sections={sections} />
}
