import { guardPage } from "@/lib/rbac/guard-page"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { SourceCatalog } from "@/components/credentials/SourceCatalog"
import { authorize } from "@/lib/rbac/authorize"
import { permissionsForRole } from "@/lib/rbac/session-permissions"
import { PROVIDERS } from "@/lib/scan/registry"
import { getScanCoverage } from "@/lib/scan/coverage"

export default async function DataApiPage() {
  const denied = await guardPage("api_credentials:read")
  if (denied) return denied

  const session = await getSession()
  const companyId = session!.user.companyId
  const perms = await permissionsForRole(session!.user.roleId ?? null)

  const [credentials, coverage, lastScan] = await Promise.all([
    prisma.apiCredential.findMany({
      where: { companyId },
      orderBy: { provider: "asc" },
      select: {
        id: true,
        provider: true,
        keyHint: true,
        rateLimitPerMinute: true,
        lastUsedAt: true,
        updatedAt: true,
      },
    }),
    getScanCoverage(companyId),
    prisma.scanCheck.aggregate({ where: { employee: { companyId } }, _max: { lastAttemptAt: true } }),
  ])

  const serialized = credentials.map((c) => ({
    ...c,
    lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
    updatedAt: c.updatedAt.toISOString(),
  }))
  const defaultRates = Object.fromEntries(PROVIDERS.map((p) => [p.id, p.defaultRatePerMinute]))

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Data API</h2>
        <p className="text-sm text-muted-foreground">
          Breach intelligence sources that feed your scans. Keys are stored encrypted (AES-256-GCM) and never
          displayed again after saving.
        </p>
      </div>

      <SourceCatalog
        credentials={serialized}
        coverage={coverage}
        defaultRates={defaultRates}
        lastScanAt={lastScan._max.lastAttemptAt?.toISOString() ?? null}
        isAdmin={authorize(perms, "api_credentials:manage")}
        canScan={authorize(perms, "employees:scan")}
      />
    </div>
  )
}
