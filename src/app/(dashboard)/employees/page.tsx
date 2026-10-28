import { guardPage } from "@/lib/rbac/guard-page"
import { getSession } from "@/lib/auth/session"
import { getEmployees } from "@/lib/employees"
import { EmployeeTable } from "@/components/employees/EmployeeTable"
import { ScanButton } from "@/components/employees/ScanButton"
import { ScanCoverageBanner } from "@/components/employees/ScanCoverageBanner"
import { getScanCoverage } from "@/lib/scan/coverage"
import { authorize } from "@/lib/rbac/authorize"
import { permissionsForRole } from "@/lib/rbac/session-permissions"

export default async function EmployeesPage() {
  const denied = await guardPage("employees:read")
  if (denied) return denied

  const session = await getSession()
  const [employees, coverage, perms] = await Promise.all([
    getEmployees(session!.user.companyId),
    getScanCoverage(session!.user.companyId),
    permissionsForRole(session!.user.roleId ?? null),
  ])
  const canScan = authorize(perms, "employees:scan")

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Employees</h2>
          <p className="text-sm text-muted-foreground">
            Monitor your workforce exposure across known data breaches
          </p>
        </div>
        <ScanButton />
      </div>
      <ScanCoverageBanner coverage={coverage} canScan={canScan} className="mb-6" />
      <EmployeeTable data={employees} />
    </div>
  )
}
