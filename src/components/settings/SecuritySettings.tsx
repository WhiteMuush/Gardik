import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { getUserPermissions, authorize } from "@/lib/rbac/authorize"
import { TwoFactorSetup } from "@/components/settings/TwoFactorSetup"
import { PasskeySetup } from "@/components/settings/PasskeySetup"
import { AuthPolicySettings } from "@/components/settings/AuthPolicySettings"
import { SsoSettings } from "@/components/settings/SsoSettings"

// The account and company security blocks, shared by /settings (always
// reachable from the sidebar) and by the onboarding checklist on /setup. They
// lived only inside /setup before, which meant they disappeared for good once a
// company had its first employee: an admin could no longer reach the SSO
// configuration or the auth policy at all.
export async function SecuritySettings() {
  const session = await getSession()
  const companyId = session!.user.companyId
  const twoFactorEnabled = session!.user.twoFactorEnabled ?? false
  const perms = await getUserPermissions(prisma, session!.user.roleId ?? null)
  const isAdmin = authorize(perms, "users:manage")
  const canReadSso = authorize(perms, "sso:read")
  const canConfigureSso = authorize(perms, "sso:config")

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { require2fa: true, allowedAuthMethods: true, ssoMandatory: true },
  })

  // No password block here on purpose: a rotation is something an
  // administrator requires, and it is done on /secure before the dashboard
  // opens, not from a settings page inside it.
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
          ssoMandatory={company.ssoMandatory}
        />
      )}
      {canReadSso && <SsoSettings canConfigure={canConfigureSso} />}
    </>
  )
}
