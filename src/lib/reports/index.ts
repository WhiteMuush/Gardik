import { getExposureSummary } from "./exposure"
import { getDataTypeExposure } from "./data-types"
import { getDepartmentBreakdown } from "./departments"
import { getEmployeeBreakdown } from "./by-employee"
import { getTrends } from "./trends"
import { getCompliance } from "./compliance"
import { buildFindings } from "./findings"
import type { ReportData } from "./types"

export type { ReportData } from "./types"

export async function getReportData(companyId: string): Promise<ReportData> {
  const [exposure, dataTypes, departments, employees, trends, compliance] =
    await Promise.all([
      getExposureSummary(companyId),
      getDataTypeExposure(companyId),
      getDepartmentBreakdown(companyId),
      getEmployeeBreakdown(companyId),
      getTrends(companyId),
      getCompliance(companyId),
    ])

  return {
    generatedAt: new Date().toISOString(),
    findings: buildFindings(exposure, compliance, dataTypes),
    exposure,
    dataTypes,
    departments,
    employees,
    trends,
    compliance,
  }
}
