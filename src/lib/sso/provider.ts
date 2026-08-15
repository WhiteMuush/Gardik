import { prisma } from "@/lib/prisma"
import { authPrisma } from "@/lib/auth/prisma"

export type ProviderRow = {
  providerId: string
  issuer: string
  domain: string
  domainVerified: boolean
  oidcConfig: string | null
}

export type MaskedProvider = {
  providerId: string
  issuer: string
  domain: string
  domainVerified: boolean
  discoveryEndpoint: string | null
  clientIdLastFour: string | null
}

// One active provider per company in v1. Reads go through the extended client so
// oidcConfig comes back as plaintext JSON in memory.
export async function findCompanyProvider(companyId: string): Promise<ProviderRow | null> {
  return authPrisma.ssoProvider.findFirst({
    where: { organizationId: companyId },
    select: { providerId: true, issuer: true, domain: true, domainVerified: true, oidcConfig: true },
  })
}

// The plugin's own access check is provider.userId === session.user.id when the
// organization plugin is absent, which would lock every admin except the one who
// registered. Our RBAC already decided the caller may act, so the row follows.
export async function takeOwnership(providerId: string, userId: string): Promise<void> {
  await prisma.ssoProvider.update({ where: { providerId }, data: { userId } })
}

export function maskedProvider(row: ProviderRow): MaskedProvider {
  let clientId: string | null = null
  let discoveryEndpoint: string | null = null
  if (row.oidcConfig) {
    const parsed = JSON.parse(row.oidcConfig) as { clientId?: string; discoveryEndpoint?: string }
    clientId = parsed.clientId ?? null
    discoveryEndpoint = parsed.discoveryEndpoint ?? null
  }
  return {
    providerId: row.providerId,
    issuer: row.issuer,
    domain: row.domain,
    domainVerified: row.domainVerified,
    discoveryEndpoint,
    clientIdLastFour: clientId ? clientId.slice(-4) : null,
  }
}
