import { auth } from "@/auth"
import { getEmployees } from "@/lib/employees"
import { EmployeeTable } from "@/components/employees/EmployeeTable"
import { ScanButton } from "@/components/employees/ScanButton"

export default async function EmployeesPage() {
  const session = await auth()
  const employees = await getEmployees(session!.user.companyId)

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Employees</h2>
          <p className="text-sm text-muted-foreground">
            Monitor your workforce exposure across known data breaches
          </p>
        </div>
        <ScanButton />
      </div>
      <EmployeeTable data={employees} />
    </div>
  )
}
