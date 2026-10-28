import type { WidgetEntry } from "@/components/dashboard/DashboardCanvas"
import { buildBreachSources, buildDataTypes } from "@/lib/dashboard-series"
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
import type { WidgetContext } from "./widget-context"

// Widgets hidden by default, added from the Widget Library.
export function libraryWidgets({ data, sourceFor }: WidgetContext): WidgetEntry[] {
  return [
    {
      instanceId: "risk-gauge",
      type: "risk-gauge",
      defaultTitle: "Company risk",
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
      content: (
        <BreachSourceDonut data={buildBreachSources(data.breachCatalog, sourceFor("breach-source-donut"))} />
      ),
    },
    {
      instanceId: "breach-timeline",
      type: "breach-timeline",
      defaultTitle: "Breach Timeline",
      defaultSize: { w: 4, h: 8 },
      minSize: { w: 3, h: 5 },
      defaultVisible: false,
      content: <BreachTimeline data={buildBreachSources(data.breachCatalog, sourceFor("breach-timeline"))} />,
    },
    {
      instanceId: "top-breaches",
      type: "top-breaches",
      defaultTitle: "Top Breaches by Impact",
      defaultSize: { w: 5, h: 6 },
      minSize: { w: 3, h: 4 },
      defaultVisible: false,
      content: <TopBreaches data={buildBreachSources(data.breachCatalog, sourceFor("top-breaches"))} />,
    },
    {
      instanceId: "data-type-radar",
      type: "data-type-radar",
      defaultTitle: "Data Type Radar",
      defaultSize: { w: 4, h: 6 },
      minSize: { w: 3, h: 4 },
      defaultVisible: false,
      content: <DataTypeRadar data={buildDataTypes(data.breachRecordsRaw, sourceFor("data-type-radar"))} />,
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
}
