import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { getUserPermissions, authorize } from "@/lib/rbac/authorize"
import { AuthPolicySettings } from "@/components/settings/AuthPolicySettings"
import { SsoSettings } from "@/components/settings/SsoSettings"

// Company-wide blocks, rendered only for the permissions that may read them.
export async function CompanySecuritySettings({ heading }: { heading?: boolean }) {
  const session = await getSession()
  const perms = await getUserPermissions(prisma, session!.user.roleId ?? null)
  const isAdmin = authorize(perms, "users:manage")
  const canReadSso = authorize(perms, "sso:read")
  if (!isAdmin && !canReadSso) return null

  const company = await prisma.company.findUnique({
    where: { id: session!.user.companyId },
    select: { require2fa: true, allowedAuthMethods: true, ssoMandatory: true },
  })

  return (
    <>
      {heading ? (
        <div className="pt-4">
          <h3 className="text-sm font-semibold text-foreground">Company</h3>
          <p className="text-xs text-muted-foreground">Settings that apply to everyone in this workspace.</p>
        </div>
      ) : null}
      {isAdmin && company && (
        <AuthPolicySettings
          require2fa={company.require2fa}
          allowedAuthMethods={company.allowedAuthMethods}
          isAdmin={isAdmin}
          ssoMandatory={company.ssoMandatory}
        />
      )}
      {canReadSso && <SsoSettings canConfigure={authorize(perms, "sso:config")} />}
    </>
  )
}
