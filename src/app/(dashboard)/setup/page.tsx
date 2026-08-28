import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { getUserPermissions, authorize } from "@/lib/rbac/authorize"
import { visiblePages } from "@/lib/rbac/page-permissions"
import { SetupChecklist } from "@/components/dashboard/SetupChecklist"
import { SecuritySettings } from "@/components/settings/SecuritySettings"

// Onboarding only. The security blocks below now have a permanent home at
// /settings, so this page no longer needs the enroll=2fa escape that used to
// keep it reachable after onboarding was over.
export default async function SetupPage() {
  const session = await getSession()
  const companyId = session!.user.companyId
  const perms = await getUserPermissions(prisma, session!.user.roleId ?? null)
  const isAdmin = authorize(perms, "users:manage")
  const visible = visiblePages(perms)

  const [employeeCount, apiKeyCount] = await Promise.all([
    prisma.employee.count({ where: { companyId } }),
    prisma.apiCredential.count({ where: { companyId } }),
  ])

  if (employeeCount > 0 || apiKeyCount > 0) redirect("/dashboard")

  return (
    <SetupChecklist
      hasEmployees={employeeCount > 0}
      hasApiKey={apiKeyCount > 0}
      isAdmin={isAdmin}
      visible={visible}
    >
      <SecuritySettings />
    </SetupChecklist>
  )
}
