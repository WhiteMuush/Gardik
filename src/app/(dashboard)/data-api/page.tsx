import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ApiCredentials } from "@/components/credentials/ApiCredentials"
import { Webhooks } from "@/components/credentials/Webhooks"
import { listWebhooks } from "@/lib/webhooks"

export default async function DataApiPage() {
  const session = await auth()
  const isAdmin = session!.user.role === "ADMIN"

  const credentials = await prisma.apiCredential.findMany({
    where: { companyId: session!.user.companyId },
    orderBy: { provider: "asc" },
    select: { id: true, provider: true, keyHint: true, lastUsedAt: true },
  })

  const serialized = credentials.map((c) => ({
    ...c,
    lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
  }))

  const webhooks = await listWebhooks(session!.user.companyId)

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
        <Webhooks initial={webhooks} isAdmin={isAdmin} />
      </div>
    </div>
  )
}
