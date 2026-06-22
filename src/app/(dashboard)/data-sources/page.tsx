import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { DirectoryConnections } from "@/components/settings/DirectoryConnections"
import { RemediationSettings } from "@/components/settings/RemediationSettings"
import { SiemExport } from "@/components/settings/SiemExport"
import { SetupGuides } from "@/components/settings/SetupGuides"

export default async function SettingsPage() {
  const session = await auth()
  const isAdmin = session!.user.role === "ADMIN"
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
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-foreground">Data Sources</h2>
        <p className="text-sm text-muted-foreground">
          Connect directories and breach feeds that power your DataShield workspace.
        </p>
      </div>

      <div className="mx-auto max-w-3xl space-y-10">
        <DirectoryConnections initial={serialized} isAdmin={isAdmin} />
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
        <SetupGuides />
      </div>
    </div>
  )
}
