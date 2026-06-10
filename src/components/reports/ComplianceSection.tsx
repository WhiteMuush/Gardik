import { ShieldCheck, BellRing, CheckCircle2, AlertTriangle } from "lucide-react"
import { StatCard } from "@/components/dashboard/StatCard"
import { ReportSection } from "./ReportSection"
import type { ComplianceSummary } from "@/lib/reports/types"

export function ComplianceSection({ data }: { data: ComplianceSummary }) {
  return (
    <ReportSection
      title="Compliance and audit"
      description="Monitoring coverage and alert handling status"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Monitored"
          value={data.monitoredEmployees}
          description={`${data.exposedEmployees} exposed`}
          icon={ShieldCheck}
        />
        <StatCard label="Open alerts" value={data.alertsOpen} icon={BellRing} variant="high" />
        <StatCard
          label="Resolved"
          value={data.alertsResolved}
          description={`${data.resolutionRate}% resolution rate`}
          icon={CheckCircle2}
          variant="ok"
        />
        <StatCard
          label="Critical open"
          value={data.criticalOpen}
          icon={AlertTriangle}
          variant={data.criticalOpen > 0 ? "critical" : "ok"}
        />
      </div>
    </ReportSection>
  )
}
