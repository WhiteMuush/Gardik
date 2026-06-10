import { getExposureSummary } from "./exposure"
import { getEmployeeBreakdown } from "./by-employee"
import { getTrends } from "./trends"
import { getCompliance } from "./compliance"
import type { ReportData } from "./types"

export type { ReportData } from "./types"

export async function getReportData(companyId: string): Promise<ReportData> {
  const [exposure, employees, trends, compliance] = await Promise.all([
    getExposureSummary(companyId),
    getEmployeeBreakdown(companyId),
    getTrends(companyId),
    getCompliance(companyId),
  ])

  return {
    generatedAt: new Date().toISOString(),
    exposure,
    employees,
    trends,
    compliance,
  }
}
