import { auth } from "@/auth"
import { getReportData } from "@/lib/reports"
import { ReportToolbar } from "@/components/reports/ReportToolbar"
import { KeyFindingsSection } from "@/components/reports/KeyFindingsSection"
import { ExposureSection } from "@/components/reports/ExposureSection"
import { DataTypeSection } from "@/components/reports/DataTypeSection"
import { DepartmentSection } from "@/components/reports/DepartmentSection"
import { TrendsSection } from "@/components/reports/TrendsSection"
import { EmployeeSection } from "@/components/reports/EmployeeSection"
import { ComplianceSection } from "@/components/reports/ComplianceSection"

function formatGeneratedAt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  })
}

export default async function ReportsPage() {
  const session = await auth()
  const data = await getReportData(session!.user.companyId)
  const companyName = session!.user.name ?? ""

  return (
    <div id="report-root" className="h-full overflow-y-auto p-6">
      <div className="mb-6 hidden print:block">
        <h1 className="text-xl font-semibold text-foreground">DataShield Security Report</h1>
        <p className="text-sm text-muted-foreground">
          {companyName}, generated {formatGeneratedAt(data.generatedAt)}
        </p>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Reports</h2>
          <p className="text-sm text-muted-foreground">
            Exposure, employees, trends and compliance overview
          </p>
        </div>
        <ReportToolbar generatedAt={data.generatedAt} />
      </div>

      <div className="space-y-6">
        <KeyFindingsSection findings={data.findings} />
        <ExposureSection data={data.exposure} />
        <DataTypeSection rows={data.dataTypes} />
        <DepartmentSection rows={data.departments} />
        <TrendsSection data={data.trends} />
        <EmployeeSection rows={data.employees} />
        <ComplianceSection data={data.compliance} />
      </div>
    </div>
  )
}
