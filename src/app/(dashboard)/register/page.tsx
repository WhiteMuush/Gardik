import { guardPage } from "@/lib/rbac/guard-page"
import { getSession } from "@/lib/auth/session"
import { authorize } from "@/lib/rbac/authorize"
import { permissionsForRole } from "@/lib/rbac/session-permissions"
import { listRegister } from "@/lib/register"
import { ExposureRegister } from "@/components/register/ExposureRegister"

export default async function RegisterPage() {
  const denied = await guardPage("register:read")
  if (denied) return denied

  const session = await getSession()
  const perms = await permissionsForRole(session!.user.roleId ?? null)
  const isAdmin = authorize(perms, "register:manage")
  const canDownloadEvidence = authorize(perms, "register:evidence")
  const entries = await listRegister(session!.user.companyId)

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Exposure Register</h2>
        <p className="text-sm text-muted-foreground">
          GDPR Article 33/30 record of confirmed exposures, with a 72-hour notification countdown.
        </p>
      </div>
      <ExposureRegister
        initial={entries}
        isAdmin={isAdmin}
        canDownloadEvidence={canDownloadEvidence}
      />
    </div>
  )
}
