import { auth } from "@/auth"
import { getDashboardData } from "@/lib/dashboard"
import { prisma } from "@/lib/prisma"
import { DashboardCanvas, type WidgetEntry } from "@/components/dashboard/DashboardCanvas"
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
import { redirect } from "next/navigation"
import type { DashboardPreset } from "@/types/dashboard"

export default async function DashboardPage() {
  const session = await auth()

  const [employeeCount, apiKeyCount] = await Promise.all([
    prisma.employee.count({ where: { companyId: session!.user.companyId } }),
    prisma.apiCredential.count({ where: { companyId: session!.user.companyId } }),
  ])

  if (employeeCount === 0 || apiKeyCount === 0) redirect("/setup")

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
      select: { activePresetId: true, role: true },
    }),
  ])

  let activePresetId = user?.activePresetId ?? null

  if (presets.length === 0) {
    const created = await prisma.dashboardPreset.create({
      data: {
        name: "Default",
        scope: "PERSONAL",
        userId: session!.user.id,
        companyId: session!.user.companyId,
        layout: [],
        widgets: [],
      },
    })
    presets.push(created)
    activePresetId = created.id
    await prisma.user.update({
      where: { id: session!.user.id },
      data: { activePresetId: created.id },
    })
  }

  const typedPresets: DashboardPreset[] = presets.map((p) => ({
    id: p.id,
    name: p.name,
    scope: p.scope as DashboardPreset["scope"],
    layout: p.layout as DashboardPreset["layout"],
    widgets: p.widgets as DashboardPreset["widgets"],
    userId: p.userId,
    companyId: p.companyId,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }))

  const widgets: WidgetEntry[] = [
    // ── Default visible ─────────────────────────────────────────────
    {
      instanceId: "stats-row",
      type: "stats-row",
      defaultTitle: "Key Metrics",
      defaultSize: { w: 12, h: 4 },
      defaultPosition: { x: 0, y: 0 },
      minSize: { w: 6, h: 3 },
      centerContent: true,
      content: <StatsRow {...data} />,
    },
    {
      instanceId: "trend-chart",
      type: "trend-chart",
      defaultTitle: "Incident Timeline",
      defaultSize: { w: 7, h: 8 },
      defaultPosition: { x: 0, y: 4 },
      minSize: { w: 4, h: 5 },
      content: <TrendChart data={data.trendData} />,
    },
    {
      instanceId: "breach-sources",
      type: "breach-sources",
      defaultTitle: "Breach Sources",
      defaultSize: { w: 5, h: 8 },
      defaultPosition: { x: 7, y: 4 },
      minSize: { w: 3, h: 4 },
      content: <BreachSourcesList data={data.breachSources} />,
    },
    {
      instanceId: "top-risky-employees",
      type: "top-risky-employees",
      defaultTitle: "Top Employees at Risk",
      defaultSize: { w: 4, h: 7 },
      defaultPosition: { x: 0, y: 12 },
      minSize: { w: 3, h: 4 },
      content: <TopRiskyEmployees data={data.topRiskyEmployees} />,
    },
    {
      instanceId: "department-risk",
      type: "department-risk",
      defaultTitle: "Department Exposure",
      defaultSize: { w: 5, h: 7 },
      defaultPosition: { x: 4, y: 12 },
      minSize: { w: 3, h: 4 },
      content: <DepartmentRisk data={data.departmentRisk} />,
    },
    {
      instanceId: "severity-donut",
      type: "severity-donut",
      defaultTitle: "Alert Severity",
      defaultSize: { w: 3, h: 7 },
      defaultPosition: { x: 9, y: 12 },
      minSize: { w: 2, h: 4 },
      content: <SeverityDonut data={data.alertSeverity} />,
    },
    {
      instanceId: "data-type-breakdown",
      type: "data-type-breakdown",
      defaultTitle: "Exposed Data Types",
      defaultSize: { w: 6, h: 6 },
      defaultPosition: { x: 0, y: 19 },
      minSize: { w: 3, h: 4 },
      content: <DataTypeBreakdown data={data.dataTypes} />,
    },
    {
      instanceId: "alerts-feed",
      type: "alerts-feed",
      defaultTitle: "Recent Alerts",
      defaultSize: { w: 6, h: 6 },
      defaultPosition: { x: 6, y: 19 },
      minSize: { w: 3, h: 4 },
      content: <AlertsFeed data={data.recentAlerts} />,
    },
    // ── Hidden by default — activate via Widget Library ──────────────
    {
      instanceId: "risk-gauge",
      type: "risk-gauge",
      defaultTitle: "Risk Score",
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 4 },
      defaultVisible: false,
      content: <RiskGauge riskScore={data.riskScore} />,
    },
    {
      instanceId: "alert-status-breakdown",
      type: "alert-status-breakdown",
      defaultTitle: "Alert Status",
      defaultSize: { w: 4, h: 5 },
      minSize: { w: 3, h: 3 },
      defaultVisible: false,
      content: <AlertStatusBreakdown data={data.alertStatusCounts} />,
    },
    {
      instanceId: "employee-exposure",
      type: "employee-exposure",
      defaultTitle: "Employee Exposure",
      defaultSize: { w: 4, h: 5 },
      minSize: { w: 3, h: 3 },
      defaultVisible: false,
      content: <EmployeeExposure data={data.employeeExposureLevels} totalEmployees={data.totalEmployees} />,
    },
    {
      instanceId: "alerts-by-month",
      type: "alerts-by-month",
      defaultTitle: "Alerts by Month",
      defaultSize: { w: 7, h: 7 },
      minSize: { w: 4, h: 5 },
      defaultVisible: false,
      content: <AlertsByMonth data={data.alertsByMonth} />,
    },
    {
      instanceId: "alert-velocity",
      type: "alert-velocity",
      defaultTitle: "Alert Velocity",
      defaultSize: { w: 5, h: 6 },
      minSize: { w: 3, h: 4 },
      defaultVisible: false,
      content: <AlertVelocity data={data.alertVelocityData} />,
    },
    {
      instanceId: "critical-alerts",
      type: "critical-alerts",
      defaultTitle: "Urgent Alerts",
      defaultSize: { w: 5, h: 7 },
      minSize: { w: 3, h: 4 },
      defaultVisible: false,
      content: <CriticalAlertsList data={data.urgentAlerts} />,
    },
    {
      instanceId: "alerts-by-department",
      type: "alerts-by-department",
      defaultTitle: "Alerts by Department",
      defaultSize: { w: 5, h: 6 },
      minSize: { w: 3, h: 4 },
      defaultVisible: false,
      content: <AlertsByDepartment data={data.alertsByDepartment} />,
    },
    {
      instanceId: "breach-source-donut",
      type: "breach-source-donut",
      defaultTitle: "Breach Origin",
      defaultSize: { w: 3, h: 6 },
      minSize: { w: 2, h: 4 },
      defaultVisible: false,
      content: <BreachSourceDonut data={data.breachSources} />,
    },
    {
      instanceId: "breach-timeline",
      type: "breach-timeline",
      defaultTitle: "Breach Timeline",
      defaultSize: { w: 4, h: 8 },
      minSize: { w: 3, h: 5 },
      defaultVisible: false,
      content: <BreachTimeline data={data.breachSources} />,
    },
    {
      instanceId: "top-breaches",
      type: "top-breaches",
      defaultTitle: "Top Breaches by Impact",
      defaultSize: { w: 5, h: 6 },
      minSize: { w: 3, h: 4 },
      defaultVisible: false,
      content: <TopBreaches data={data.breachSources} />,
    },
    {
      instanceId: "data-type-radar",
      type: "data-type-radar",
      defaultTitle: "Data Type Radar",
      defaultSize: { w: 4, h: 6 },
      minSize: { w: 3, h: 4 },
      defaultVisible: false,
      content: <DataTypeRadar data={data.dataTypes} />,
    },
  ]

  return (
    <DashboardCanvas
      widgets={widgets}
      presets={typedPresets}
      activePresetId={activePresetId}
      userRole={user?.role ?? "VIEWER"}
    />
  )
}
