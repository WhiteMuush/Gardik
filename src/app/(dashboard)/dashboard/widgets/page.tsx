import { guardPage } from "@/lib/rbac/guard-page"
import { getSession } from "@/lib/auth/session"
import { getDashboardData } from "@/lib/dashboard"
import { prisma } from "@/lib/prisma"
import { WIDGETS } from "@/lib/widgetRegistry"
import { permissionsForRole } from "@/lib/rbac/session-permissions"
import { visiblePages } from "@/lib/rbac/page-permissions"
import { WidgetLibrary } from "@/components/dashboard/WidgetLibrary"
import { DetailDrawerProvider } from "@/contexts/DetailDrawerContext"
import { StatsRow } from "@/components/dashboard/StatsRow"
import { TrendChart } from "@/components/dashboard/TrendChart"
import { DataTypeBreakdown } from "@/components/dashboard/DataTypeBreakdown"
import { BreachSourcesList } from "@/components/dashboard/BreachSourcesList"
import { TopRiskyEmployees } from "@/components/dashboard/TopRiskyEmployees"
import { DepartmentRisk } from "@/components/dashboard/DepartmentRisk"
import { AlertsFeed } from "@/components/dashboard/AlertsFeed"
import { SeverityDonut } from "@/components/dashboard/SeverityDonut"
import { RiskGauge } from "@/components/dashboard/RiskGauge"
import { AlertsByMonth } from "@/components/dashboard/AlertsByMonth"
import { BreachSourceDonut } from "@/components/dashboard/BreachSourceDonut"
import { CriticalAlertsList } from "@/components/dashboard/CriticalAlertsList"
import { AlertsByDepartment } from "@/components/dashboard/AlertsByDepartment"
import { EmployeeExposure } from "@/components/dashboard/EmployeeExposure"
import { AlertStatusBreakdown } from "@/components/dashboard/AlertStatusBreakdown"
import { BreachTimeline } from "@/components/dashboard/BreachTimeline"
import { TopBreaches } from "@/components/dashboard/TopBreaches"
import { DataTypeRadar } from "@/components/dashboard/DataTypeRadar"
import { AlertVelocity } from "@/components/dashboard/AlertVelocity"
import type { DashboardPreset } from "@/types/dashboard"
import type { ReactNode } from "react"
import { redirect } from "next/navigation"

export default async function WidgetsPage() {
  const denied = await guardPage("dashboard:customize")
  if (denied) return denied

  const session = await getSession()

  const [data, presets, user] = await Promise.all([
    getDashboardData(session!.user.companyId),
    prisma.dashboardPreset.findMany({
      where: {
        OR: [
          { userId: session!.user.id, scope: "PERSONAL" },
          { companyId: session!.user.companyId, scope: "COMPANY" },
        ],
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findUnique({
      where: { id: session!.user.id },
      select: { activePresetId: true },
    }),
  ])

  // Nothing to customise. Through the root: dashboard:customize opens this
  // page and does not imply dashboard:read.
  if (presets.length === 0) redirect("/")

  const activePreset =
    presets.find((p) => p.id === user?.activePresetId) ?? presets[0]

  const perms = await permissionsForRole(session!.user.roleId ?? null)
  const visible = visiblePages(perms)

  const preset: DashboardPreset = {
    id: activePreset.id,
    name: activePreset.name,
    scope: activePreset.scope as DashboardPreset["scope"],
    layout: activePreset.layout as DashboardPreset["layout"],
    widgets: activePreset.widgets as DashboardPreset["widgets"],
    userId: activePreset.userId,
    companyId: activePreset.companyId,
    createdAt: activePreset.createdAt.toISOString(),
    updatedAt: activePreset.updatedAt.toISOString(),
  }

  const widgetPreviews: Record<string, ReactNode> = {
    "stats-row":             <StatsRow {...data} />,
    "trend-chart":           <TrendChart data={data.trendData} />,
    "data-type-breakdown":   <DataTypeBreakdown data={data.dataTypes} />,
    "breach-sources":        <BreachSourcesList data={data.breachSources} />,
    "top-risky-employees":   <TopRiskyEmployees data={data.topRiskyEmployees} />,
    "department-risk":       <DepartmentRisk data={data.departmentRisk} />,
    "alerts-feed":           <AlertsFeed data={data.recentAlerts} />,
    "severity-donut":        <SeverityDonut data={data.alertSeverity} />,
    "risk-gauge":            <RiskGauge riskScore={data.riskScore} />,
    "alert-status-breakdown":<AlertStatusBreakdown data={data.alertStatusCounts} />,
    "employee-exposure":     <EmployeeExposure data={data.employeeExposureLevels} totalEmployees={data.totalEmployees} />,
    "alerts-by-month":       <AlertsByMonth data={data.alertsByMonth} />,
    "alert-velocity":        <AlertVelocity data={data.alertVelocityData} />,
    "critical-alerts":       <CriticalAlertsList data={data.urgentAlerts} />,
    "alerts-by-department":  <AlertsByDepartment data={data.alertsByDepartment} />,
    "breach-source-donut":   <BreachSourceDonut data={data.breachSources} />,
    "breach-timeline":       <BreachTimeline data={data.breachSources} />,
    "top-breaches":          <TopBreaches data={data.breachSources} />,
    "data-type-radar":       <DataTypeRadar data={data.dataTypes} />,
  }

  return (
    <DetailDrawerProvider>
      <WidgetLibrary
        preset={preset}
        allWidgets={WIDGETS}
        widgetPreviews={widgetPreviews}
        visible={visible}
      />
    </DetailDrawerProvider>
  )
}
