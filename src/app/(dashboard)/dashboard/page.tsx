import { guardPage } from "@/lib/rbac/guard-page"
import { getSession } from "@/lib/auth/session"
import { getUserPermissions, authorize } from "@/lib/rbac/authorize"
import { visiblePages } from "@/lib/rbac/page-permissions"
import { getDashboardData, buildTrendData, buildBreachSources, buildDataTypes } from "@/lib/dashboard"
import { providerMeta } from "@/lib/credentials/providers"
import { prisma } from "@/lib/prisma"
import type { ApiProvider } from "@prisma/client"
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
import { MfaCoverage } from "@/components/dashboard/MfaCoverage"
import { redirect } from "next/navigation"
import type { DashboardPreset } from "@/types/dashboard"

export default async function DashboardPage() {
  const denied = await guardPage("dashboard:read")
  if (denied) return denied

  const session = await getSession()

  const [employeeCount, apiKeyCount] = await Promise.all([
    prisma.employee.count({ where: { companyId: session!.user.companyId } }),
    prisma.apiCredential.count({ where: { companyId: session!.user.companyId } }),
  ])

  if (employeeCount === 0 && apiKeyCount === 0) redirect("/setup")

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

  let activePresetId = user?.activePresetId ?? null

  const perms = await getUserPermissions(prisma, session!.user.roleId ?? null)
  const canManageShared = authorize(perms, "dashboard:manage_shared")
  const visible = visiblePages(perms)

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

  const credentials = await prisma.apiCredential.findMany({
    where: { companyId: session!.user.companyId },
    select: { provider: true },
  })
  const sourceOptions = credentials.map((c) => ({
    id: c.provider as string,
    label: providerMeta(c.provider)?.label ?? c.provider,
  }))

  // Gate breach data to the providers the company actually connected: a record
  // only counts if one of its reporting sources has a stored API credential.
  // "All sources" therefore means the union of connected providers, and with no
  // API connected the breach widgets show nothing.
  const connected = new Set(credentials.map((c) => c.provider))
  const isConnected = (sources: ApiProvider[]) => sources.some((s) => connected.has(s))
  const gatedRecords = data.breachRecordsRaw.filter((r) => isConnected(r.sources))
  const gatedCatalog = data.breachCatalog
    .map((b) => ({ ...b, records: b.records.filter((r) => isConnected(r.sources)) }))
    .filter((b) => b.records.length > 0)

  // Per-instance provider scope, read from the active preset. Source-filterable
  // widgets re-derive their slice from the raw datasets for the chosen provider.
  const activeWidgets = typedPresets.find((p) => p.id === activePresetId)?.widgets ?? []
  const sourceFor = (instanceId: string): ApiProvider | undefined => {
    const s = activeWidgets.find((w) => w.instanceId === instanceId)?.source
    return (s ?? undefined) as ApiProvider | undefined
  }

  const widgets: WidgetEntry[] = [
    // --- Default visible
    {
      instanceId: "stats-row",
      type: "stats-row",
      defaultTitle: "Key Metrics",
      defaultSize: { w: 12, h: 4 },
      defaultPosition: { x: 0, y: 0 },
      minSize: { w: 6, h: 3 },
      centerContent: true,
      content: (
        <StatsRow
          compromisedEmployees={data.compromisedEmployees}
          totalEmployees={data.totalEmployees}
          openAlerts={data.openAlerts}
          recentBreaches={data.recentBreaches}
          riskScore={data.riskScore}
        />
      ),
    },
    {
      instanceId: "trend-chart",
      type: "trend-chart",
      defaultTitle: "Incident Timeline",
      defaultSize: { w: 7, h: 8 },
      defaultPosition: { x: 0, y: 4 },
      minSize: { w: 4, h: 5 },
      content: <TrendChart data={buildTrendData(gatedRecords, sourceFor("trend-chart"))} />,
    },
    {
      instanceId: "breach-sources",
      type: "breach-sources",
      defaultTitle: "Breach Sources",
      defaultSize: { w: 5, h: 8 },
      defaultPosition: { x: 7, y: 4 },
      minSize: { w: 3, h: 4 },
      content: <BreachSourcesList data={buildBreachSources(gatedCatalog, sourceFor("breach-sources"))} />,
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
      content: <DataTypeBreakdown data={buildDataTypes(gatedRecords, sourceFor("data-type-breakdown"))} />,
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
    // --- Hidden by default: activate via Widget Library
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
      content: <BreachSourceDonut data={buildBreachSources(gatedCatalog, sourceFor("breach-source-donut"))} />,
    },
    {
      instanceId: "breach-timeline",
      type: "breach-timeline",
      defaultTitle: "Breach Timeline",
      defaultSize: { w: 4, h: 8 },
      minSize: { w: 3, h: 5 },
      defaultVisible: false,
      content: <BreachTimeline data={buildBreachSources(gatedCatalog, sourceFor("breach-timeline"))} />,
    },
    {
      instanceId: "top-breaches",
      type: "top-breaches",
      defaultTitle: "Top Breaches by Impact",
      defaultSize: { w: 5, h: 6 },
      minSize: { w: 3, h: 4 },
      defaultVisible: false,
      content: <TopBreaches data={buildBreachSources(gatedCatalog, sourceFor("top-breaches"))} />,
    },
    {
      instanceId: "data-type-radar",
      type: "data-type-radar",
      defaultTitle: "Data Type Radar",
      defaultSize: { w: 4, h: 6 },
      minSize: { w: 3, h: 4 },
      defaultVisible: false,
      content: <DataTypeRadar data={buildDataTypes(gatedRecords, sourceFor("data-type-radar"))} />,
    },
    {
      instanceId: "mfa-coverage",
      type: "mfa-coverage",
      defaultTitle: "MFA Coverage",
      defaultSize: { w: 4, h: 5 },
      minSize: { w: 3, h: 3 },
      defaultVisible: false,
      content: <MfaCoverage data={data.mfaCoverage} />,
    },
  ]

  return (
    <DashboardCanvas
      widgets={widgets}
      presets={typedPresets}
      activePresetId={activePresetId}
      canManageShared={canManageShared}
      visible={visible}
      sourceOptions={sourceOptions}
    />
  )
}
