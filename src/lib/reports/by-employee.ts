import { getEmployees } from "@/lib/employees"
import type { EmployeeReportRow } from "./types"

export async function getEmployeeBreakdown(companyId: string): Promise<EmployeeReportRow[]> {
  const employees = await getEmployees(companyId)

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
