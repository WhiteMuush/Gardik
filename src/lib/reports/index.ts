import { getExposureSummary } from "./exposure"
import { getDataTypeExposure } from "./data-types"
import { getDepartmentBreakdown } from "./departments"
import { getEmployeeBreakdown } from "./by-employee"
import { getTrends } from "./trends"
import { getCompliance } from "./compliance"
import { buildFindings } from "./findings"
import { getDeltas } from "./deltas"
import { getOrgInfo } from "./org"
import { EMPTY_FILTERS, type ReportFilters } from "./filters"
import type { ReportData } from "./types"

export type { ReportData } from "./types"
export type { ReportFilters } from "./filters"

export async function getReportData(
  companyId: string,
  filters: ReportFilters = EMPTY_FILTERS,
): Promise<ReportData> {
  const [org, exposure, dataTypes, departments, employees, trends, compliance, deltas] =
    await Promise.all([
      getOrgInfo(companyId),
      getExposureSummary(companyId, filters),
      getDataTypeExposure(companyId, filters),
      getDepartmentBreakdown(companyId, filters),
      getEmployeeBreakdown(companyId, filters),
      getTrends(companyId, filters),
      getCompliance(companyId, filters),
      getDeltas(companyId, filters),
    ])

  return {
    generatedAt: new Date().toISOString(),
    org,
    findings: buildFindings(exposure, compliance, dataTypes, deltas, employees),
    exposure,
    dataTypes,
    departments,
    employees,
    trends,
    compliance,
    deltas,
  }
}
