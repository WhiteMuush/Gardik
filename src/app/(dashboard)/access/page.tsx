import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { getUserPermissions, authorize } from "@/lib/rbac/authorize"
import { RolesManager } from "@/components/rbac/RolesManager"
import { UserRoleAssignment } from "@/components/rbac/UserRoleAssignment"
import { AuditTrail } from "@/components/rbac/AuditTrail"

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

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Access management</h1>
        <p className="text-sm text-muted-foreground">Roles, assignments, and the audit trail.</p>
      </div>
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-foreground">Roles</h2>
        <RolesManager />
      </section>
      {canManageUsers && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-foreground">People</h2>
          <UserRoleAssignment />
        </section>
      )}
      {canReadAudit && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-foreground">Audit trail</h2>
          <AuditTrail />
        </section>
      )}
    </main>
  )
}
