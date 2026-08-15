import { guardPage } from "@/lib/rbac/guard-page"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { ApiCredentials } from "@/components/credentials/ApiCredentials"
import { getUserPermissions, authorize } from "@/lib/rbac/authorize"

export default async function DataApiPage() {
  const denied = await guardPage("api_credentials:read")
  if (denied) return denied

  const session = await getSession()
  const perms = await getUserPermissions(prisma, session!.user.roleId ?? null)
  const isAdmin = authorize(perms, "api_credentials:manage")

  const credentials = await prisma.apiCredential.findMany({
    where: { companyId: session!.user.companyId },
    orderBy: { provider: "asc" },
    select: { id: true, provider: true, keyHint: true, lastUsedAt: true },
  })

  const serialized = credentials.map((c) => ({
    ...c,
    lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
  }))

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-foreground">Data API</h2>
        <p className="text-sm text-muted-foreground">
          Manage the breach intelligence API keys that feed your DataShield scans.
        </p>
      </div>

      <div className="mx-auto max-w-3xl space-y-6">
        <ApiCredentials initial={serialized} isAdmin={isAdmin} />
      </div>
    </div>
  )
}
