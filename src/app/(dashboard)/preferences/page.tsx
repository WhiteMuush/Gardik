import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { loadPreferences } from "@/lib/preferences/load"
import { permissionsForRole } from "@/lib/rbac/session-permissions"
import { visiblePages } from "@/lib/rbac/page-permissions"
import { PreferencesForm } from "@/components/preferences/PreferencesForm"

const sections: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/employees": "Employees",
  "/alerts": "Alerts",
  "/reports": "Reports",
  "/register": "Exposure Register",
  "/data-sources": "Data Sources",
  "/data-api": "Data API",
  "/notifications": "Notifications",
  "/access": "Access",
}

// Not /settings, since next.config.ts permanently redirects it and browsers cache the 308.
export default async function PreferencesPage() {
  const session = await getSession()
  const visible = visiblePages(await permissionsForRole(session!.user.roleId ?? null))
  const homePages = visible.flatMap((path) => (sections[path] ? [{ path, label: sections[path] }] : []))

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground">Settings</h2>
          <p className="text-sm text-muted-foreground">
            How Gardik looks and behaves for you. Nobody else in your company is affected.
          </p>
        </div>

        <PreferencesForm initial={await loadPreferences(prisma, session!.user.id)} homePages={homePages} />
      </div>
    </div>
  )
}
