import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { TwoFactorSetup } from "@/components/settings/TwoFactorSetup"
import { PasskeySetup } from "@/components/settings/PasskeySetup"
import { CompanySecuritySettings } from "@/components/settings/CompanySecuritySettings"

// Security blocks for the onboarding checklist on /setup; /security composes its own sections.
export async function SecuritySettings() {
  const session = await getSession()
  const twoFactorEnabled = session!.user.twoFactorEnabled ?? false
  const company = await prisma.company.findUnique({
    where: { id: session!.user.companyId },
    select: { allowedAuthMethods: true },
  })

  return (
    <>
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
            Sign in with your device (Face ID, Windows Hello, or a security key) instead of a password.
          </p>
          <div className="mt-3">
            <PasskeySetup />
          </div>
        </div>
      )}
      <CompanySecuritySettings />
    </>
  )
}
