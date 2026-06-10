import { auth } from "@/auth"
import { getReportData } from "@/lib/reports"
import { ReportToolbar } from "@/components/reports/ReportToolbar"
import { ExposureSection } from "@/components/reports/ExposureSection"
import { TrendsSection } from "@/components/reports/TrendsSection"
import { EmployeeSection } from "@/components/reports/EmployeeSection"
import { ComplianceSection } from "@/components/reports/ComplianceSection"

export default async function ReportsPage() {
  const session = await auth()
  const data = await getReportData(session!.user.companyId)

  return (
    <div id="report-root" className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Reports</h2>
          <p className="text-sm text-muted-foreground">
            Exposure, employees, trends and compliance overview
          </p>
        </div>
        <ReportToolbar generatedAt={data.generatedAt} />
      </div>

      <div className="space-y-6">
        <ExposureSection data={data.exposure} />
        <TrendsSection data={data.trends} />
        <EmployeeSection rows={data.employees} />
        <ComplianceSection data={data.compliance} />
      </div>
    </div>
  )
}
