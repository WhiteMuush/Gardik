import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { SetupChecklist } from "@/components/dashboard/SetupChecklist"
import { TwoFactorSetup } from "@/components/settings/TwoFactorSetup"

export default async function SetupPage() {
  const session = await getSession()
  const companyId = session!.user.companyId
  const twoFactorEnabled = session!.user.twoFactorEnabled ?? false

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
    >
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <h3 className="text-sm font-medium text-foreground">Two-factor authentication</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Add an authenticator app for an extra layer of account security.
        </p>
        <div className="mt-3">
          <TwoFactorSetup enabled={twoFactorEnabled} />
        </div>
      </div>
    </SetupChecklist>
  )
}
