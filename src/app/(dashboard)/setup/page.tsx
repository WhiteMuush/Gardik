import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { SetupChecklist } from "@/components/dashboard/SetupChecklist"
import { TwoFactorSetup } from "@/components/settings/TwoFactorSetup"
import { PasskeySetup } from "@/components/settings/PasskeySetup"
import { AuthPolicySettings } from "@/components/settings/AuthPolicySettings"

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ enroll?: string }>
}) {
  const { enroll } = await searchParams
  const enrolling = enroll === "2fa"

  const session = await getSession()
  const companyId = session!.user.companyId
  const twoFactorEnabled = session!.user.twoFactorEnabled ?? false
  const isAdmin = session!.user.role === "ADMIN"

  const [employeeCount, apiKeyCount, company] = await Promise.all([
    prisma.employee.count({ where: { companyId } }),
    prisma.apiCredential.count({ where: { companyId } }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { require2fa: true, allowedAuthMethods: true },
    }),
  ])

  if ((employeeCount > 0 || apiKeyCount > 0) && !enrolling) redirect("/dashboard")

  return (
    <SetupChecklist
      hasEmployees={employeeCount > 0}
      hasApiKey={apiKeyCount > 0}
      isAdmin={isAdmin}
    >
      {(company?.allowedAuthMethods.includes("TOTP") ?? true) && (
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <h3 className="text-sm font-medium text-foreground">Two-factor authentication</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Add an authenticator app for an extra layer of account security.
          </p>
          <div className="mt-3">
            <TwoFactorSetup enabled={twoFactorEnabled} />
          </div>
        </div>
      )}
      {company?.allowedAuthMethods.includes("PASSKEY") && (
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <h3 className="text-sm font-medium text-foreground">Passkeys</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Sign in with your device (Face ID, Windows Hello, or a security key)
            instead of a password.
          </p>
          <div className="mt-3">
            <PasskeySetup />
          </div>
        </div>
      )}
      {isAdmin && company && (
        <AuthPolicySettings
          require2fa={company.require2fa}
          allowedAuthMethods={company.allowedAuthMethods}
          isAdmin={isAdmin}
        />
      )}
    </SetupChecklist>
  )
}
