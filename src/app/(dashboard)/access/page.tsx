import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { authorize } from "@/lib/rbac/authorize"
import { permissionsForRole } from "@/lib/rbac/session-permissions"
import { guardPage } from "@/lib/rbac/guard-page"
import { RolesManager } from "@/components/rbac/RolesManager"
import { UserCreateForm } from "@/components/rbac/UserCreateForm"
import { UserRoleAssignment } from "@/components/rbac/UserRoleAssignment"
import { AuditTrail } from "@/components/rbac/AuditTrail"
import { AccessTabs } from "@/components/rbac/AccessTabs"

export default async function AccessPage() {
  const denied = await guardPage("roles:read")
  if (denied) return denied

  const session = await getSession()
  if (!session) redirect("/login")
  const perms = await permissionsForRole(session.user.roleId ?? null)

  // users:manage, since READ_ONLY grants users:read and a Viewer would see a dropdown the server always refuses.
  const canManageUsers = authorize(perms, "users:manage")
  const canReadAudit = authorize(perms, "audit:read")

  // The shell never scrolls, so the page owns its scrolling or the permission editor pushes content out of reach.
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Access</h2>
        <p className="text-sm text-muted-foreground">
          Who can do what in this workspace, and a record of every change
        </p>
      </div>

      <AccessTabs
        tabs={[
          { id: "roles", label: "Roles", panel: <RolesManager /> },
          ...(canManageUsers
            ? [
                {
                  id: "people",
                  label: "People",
                  panel: (
                    <>
                      <UserCreateForm />
                      <UserRoleAssignment />
                    </>
                  ),
                },
              ]
            : []),
          ...(canReadAudit ? [{ id: "audit", label: "Audit trail", panel: <AuditTrail /> }] : []),
        ]}
      />
    </div>
  )
}
