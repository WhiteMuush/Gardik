import type { WidgetEntry } from "@/components/dashboard/DashboardCanvas"
import { buildTrendData, buildBreachSources, buildDataTypes } from "@/lib/dashboard-series"
import { StatsRow } from "@/components/dashboard/StatsRow"
import { TrendChart } from "@/components/dashboard/TrendChart"
import { DataTypeBreakdown } from "@/components/dashboard/DataTypeBreakdown"
import { BreachSourcesList } from "@/components/dashboard/BreachSourcesList"
import { TopRiskyEmployees } from "@/components/dashboard/TopRiskyEmployees"
import { DepartmentRisk } from "@/components/dashboard/DepartmentRisk"
import { AlertsFeed } from "@/components/dashboard/AlertsFeed"
import { SeverityDonut } from "@/components/dashboard/SeverityDonut"
import type { WidgetContext } from "./widget-context"

// Widgets shown on a new dashboard.
export function defaultWidgets({
  data,
  gatedRecords,
  gatedCatalog,
  sourceFor,
}: WidgetContext): WidgetEntry[] {
  return [
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
  ]
}
