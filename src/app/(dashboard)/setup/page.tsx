import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { permissionsForRole } from "@/lib/rbac/session-permissions"
import { visiblePages } from "@/lib/rbac/page-permissions"
import { SetupChecklist } from "@/components/dashboard/SetupChecklist"
import { SecuritySettings } from "@/components/settings/SecuritySettings"

// Onboarding only. The security blocks below now have a permanent home at
// /settings, so this page no longer needs the enroll=2fa escape that used to
// keep it reachable after onboarding was over.
export default async function SetupPage() {
  const session = await getSession()
  const companyId = session!.user.companyId
  const perms = await permissionsForRole(session!.user.roleId ?? null)
  const visible = visiblePages(perms)

  const [employeeCount, apiKeyCount] = await Promise.all([
    prisma.employee.count({ where: { companyId } }),
    prisma.apiCredential.count({ where: { companyId } }),
  ])

  // Onboarding is over. Through the root, because a role that reaches this
  // page is not guaranteed to hold dashboard:read.
  if (employeeCount > 0 || apiKeyCount > 0) redirect("/")

  return (
    <SetupChecklist
      hasEmployees={employeeCount > 0}
      hasApiKey={apiKeyCount > 0}
      visible={visible}
    >
      <SecuritySettings />
    </SetupChecklist>
  )
}
