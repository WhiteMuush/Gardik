import { getEmployees } from "@/lib/employees"
import { breachRecordSome, employeeWhere, type ReportFilters } from "./filters"
import type { EmployeeReportRow } from "./types"

export async function getEmployeeBreakdown(companyId: string, f: ReportFilters): Promise<EmployeeReportRow[]> {
  const employees = await getEmployees(companyId, {
    where: employeeWhere(companyId, f),
    recordWhere: breachRecordSome(f),
  })

  return employees.map((e) => ({
    name: `${e.firstName} ${e.lastName}`,
    email: e.email,
    department: e.department,
    breachCount: e.breachCount,
    exposedDataTypes: e.exposedDataTypes,
    lastDetectedAt: e.lastDetectedAt ? e.lastDetectedAt.toISOString() : null,
    riskLevel: e.riskLevel,
  }))
}
