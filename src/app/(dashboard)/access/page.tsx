import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { getUserPermissions, authorize } from "@/lib/rbac/authorize"
import { RolesManager } from "@/components/rbac/RolesManager"
import { UserRoleAssignment } from "@/components/rbac/UserRoleAssignment"
import { AuditTrail } from "@/components/rbac/AuditTrail"
import { AccessTabs } from "@/components/rbac/AccessTabs"

export default async function AccessPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  const perms = await getUserPermissions(prisma, session.user.roleId ?? null)
  if (!authorize(perms, "roles:read")) redirect("/dashboard")

  // users:manage, not users:read: the section exists only to reassign roles, and
  // READ_ONLY grants every ":read" permission, so gating on read would show a
  // Viewer a dropdown the server refuses on every change.
  const canManageUsers = authorize(perms, "users:manage")
  const canReadAudit = authorize(perms, "audit:read")

  // The shell is h-screen with overflow-hidden at every level, so a page owns its
  // own scrolling. Without the outer container the permission editor pushes the
  // rest of the page past the fold with no way to reach it, and the panel can no
  // longer be closed. Same shape as every other dashboard page.
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
            ? [{ id: "people", label: "People", panel: <UserRoleAssignment /> }]
            : []),
          ...(canReadAudit ? [{ id: "audit", label: "Audit trail", panel: <AuditTrail /> }] : []),
        ]}
      />
    </div>
  )
}
