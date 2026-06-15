import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { SetupChecklist } from "@/components/dashboard/SetupChecklist"

export default async function SetupPage() {
  const session = await auth()
  const companyId = session!.user.companyId

  const [employeeCount, apiKeyCount] = await Promise.all([
    prisma.employee.count({ where: { companyId } }),
    prisma.apiCredential.count({ where: { companyId } }),
  ])

  if (employeeCount > 0 || apiKeyCount > 0) redirect("/dashboard")

  return (
    <SetupChecklist
      hasEmployees={employeeCount > 0}
      hasApiKey={apiKeyCount > 0}
      isAdmin={session!.user.role === "ADMIN"}
    />
  )
}
