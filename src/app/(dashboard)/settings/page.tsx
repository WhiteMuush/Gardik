import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { DirectoryConnections } from "@/components/settings/DirectoryConnections"
import { SetupGuides } from "@/components/settings/SetupGuides"

export default async function SettingsPage() {
  const session = await auth()
  const isAdmin = session!.user.role === "ADMIN"

  const connections = await prisma.directoryConnection.findMany({
    where: { companyId: session!.user.companyId },
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
  })

  const serialized = connections.map((c) => ({
    ...c,
    lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  }))

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage integrations and configuration for your DataShield workspace.
        </p>
      </div>

      <div className="mx-auto max-w-3xl space-y-10">
        <DirectoryConnections initial={serialized} isAdmin={isAdmin} />
        <SetupGuides />
      </div>
    </div>
  )
}
