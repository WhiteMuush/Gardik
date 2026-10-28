import { guardPage } from "@/lib/rbac/guard-page"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { authorize } from "@/lib/rbac/authorize"
import { permissionsForRole } from "@/lib/rbac/session-permissions"
import { DirectoryCatalog } from "@/components/settings/directory/DirectoryCatalog"
import { RemediationSettings } from "@/components/settings/RemediationSettings"
import { SiemExport } from "@/components/settings/SiemExport"

export default async function SettingsPage() {
  const denied = await guardPage("connectors:read")
  if (denied) return denied

  const session = await getSession()
  const perms = await permissionsForRole(session!.user.roleId ?? null)
  const isAdmin = authorize(perms, "connectors:manage")
  const companyId = session!.user.companyId

  const [connections, company, remediationLog] = await Promise.all([
    prisma.directoryConnection.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        type: true,
        name: true,
        status: true,
        lastSyncAt: true,
        lastSyncCount: true,
        errorMessage: true,
        createdAt: true,
      },
    }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { remediationEnabled: true, siemTokenHint: true, siemPushHint: true, siemPushFormat: true },
    }),
    prisma.remediationAction.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { action: true, status: true, target: true, detail: true, createdAt: true },
    }),
  ])

  const serialized = connections.map((c) => ({
    ...c,
    lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  }))

  const remediationRecent = remediationLog.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }))

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Data Sources</h2>
        <p className="text-sm text-muted-foreground">
          Directories that feed your employee list. Open a tile to connect, sync or follow its setup guide.
        </p>
      </div>

      <DirectoryCatalog initial={serialized} isAdmin={isAdmin} />

      <section className="mt-10">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Settings</h3>
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <RemediationSettings
            enabled={company?.remediationEnabled ?? false}
            isAdmin={isAdmin}
            recent={remediationRecent}
          />
          <SiemExport
            companyId={companyId}
            tokenHint={company?.siemTokenHint ?? null}
            pushHint={company?.siemPushHint ?? null}
            pushFormat={company?.siemPushFormat ?? null}
            isAdmin={isAdmin}
          />
        </div>
      </section>
    </div>
  )
}
