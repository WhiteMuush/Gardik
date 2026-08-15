import { guardPage } from "@/lib/rbac/guard-page"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { getReportData } from "@/lib/reports"
import { parseReportFilters, filtersToQuery } from "@/lib/reports/filters"
import { PRESET_DATA_TYPES } from "@/lib/dataTypes"
import { ReportToolbar } from "@/components/reports/ReportToolbar"
import { ReportFilterBar } from "@/components/reports/ReportFilterBar"
import { ReportCanvas, type ReportSectionEntry } from "@/components/reports/ReportCanvas"
import { KeyFindingsSection } from "@/components/reports/KeyFindingsSection"
import { ExposureSection } from "@/components/reports/ExposureSection"
import { DataTypeSection } from "@/components/reports/DataTypeSection"
import { DepartmentSection } from "@/components/reports/DepartmentSection"
import { TrendsSection } from "@/components/reports/TrendsSection"
import { EmployeeSection } from "@/components/reports/EmployeeSection"
import { ComplianceSection } from "@/components/reports/ComplianceSection"

function formatGeneratedAt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })
}

type SearchParams = Record<string, string | string[] | undefined>

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const denied = await guardPage("reports:read")
  if (denied) return denied

  const session = await getSession()
  const companyId = session!.user.companyId

  const sp = await searchParams
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") params.set(k, v)
  }
  const filters = parseReportFilters(params)
  const filterQuery = filtersToQuery(filters)

  const [data, deptGroups] = await Promise.all([
    getReportData(companyId, filters),
    prisma.employee.groupBy({ by: ["department"], where: { companyId } }),
  ])

  const departments = [
    ...deptGroups.map((d) => d.department).filter((d): d is string => d !== null).sort(),
    ...(deptGroups.some((d) => d.department === null) ? ["Unknown"] : []),
  ]
  const companyName = session!.user.name ?? ""

  const sections: ReportSectionEntry[] = [
    { id: "findings", title: "Key Findings", defaultSpan: 12, content: <KeyFindingsSection findings={data.findings} /> },
    { id: "exposure", title: "Exposure", defaultSpan: 12, content: <ExposureSection data={data.exposure} deltas={data.deltas} /> },
    { id: "datatypes", title: "Data Types", defaultSpan: 6, content: <DataTypeSection rows={data.dataTypes} /> },
    { id: "departments", title: "Departments", defaultSpan: 6, content: <DepartmentSection rows={data.departments} /> },
    { id: "trends", title: "Trends", defaultSpan: 12, content: <TrendsSection data={data.trends} /> },
    { id: "employees", title: "Employees", defaultSpan: 12, content: <EmployeeSection rows={data.employees} /> },
    { id: "compliance", title: "Compliance", defaultSpan: 12, content: <ComplianceSection data={data.compliance} deltas={data.deltas} /> },
  ]

  return (
    <div id="report-root" className="flex h-full flex-col overflow-y-scroll p-6 [scrollbar-gutter:stable]">
      <div className="mb-6 hidden print:block">
        <h1 className="text-xl font-semibold text-foreground">DataShield Security Report</h1>
        <p className="text-sm text-muted-foreground">
          {companyName}, generated {formatGeneratedAt(data.generatedAt)}
        </p>
      </div>

      <div className="no-print mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Reports</h2>
          <p className="text-sm text-muted-foreground">Exposure, employees, trends and compliance overview</p>
        </div>
        <ReportToolbar generatedAt={data.generatedAt} filterQuery={filterQuery} />
      </div>

      <div className="no-print mb-4">
        <ReportFilterBar filters={filters} departments={departments} dataTypes={PRESET_DATA_TYPES.map((t) => ({ key: t.key, label: t.label }))} />
      </div>

      {/* Interactive grid (screen) */}
      <ReportCanvas sections={sections} />

      {/* Print-only stacked layout */}
      <div className="hidden space-y-6 print:block">
        {sections.map((s) => (
          <div key={s.id}>{s.content}</div>
        ))}
      </div>
    </div>
  )
}
