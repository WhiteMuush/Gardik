import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { isAPIError } from "better-auth/api"
import { requirePermission } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth/server"
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"
import { findCompanyProvider, takeOwnership } from "@/lib/sso/provider"

// Mirrors the plugin's getVerificationIdentifier: an RFC 8552 underscore prefix, then the providerId.
function recordName(providerId: string, domain: string): string {
  return `_better-auth-token-${providerId}.${domain}`
}

export async function POST() {
  const { session, error } = await requirePermission("sso:config")
  if (error) return error

  const provider = await findCompanyProvider(session.user.companyId)
  if (!provider) return NextResponse.json({ error: "No SSO provider configured" }, { status: 404 })
  if (provider.domainVerified) {
    return NextResponse.json({ error: "Domain already verified" }, { status: 409 })
  }

  await takeOwnership(provider.providerId, session.user.id)
  const result = await auth.api.requestDomainVerification({
    body: { providerId: provider.providerId },
    headers: await headers(),
  })

  return NextResponse.json({
    record: {
      name: recordName(provider.providerId, provider.domain),
      value: result.domainVerificationToken,
    },
  })
}

export async function PUT() {
  const { session, error } = await requirePermission("sso:config")
  if (error) return error

  const provider = await findCompanyProvider(session.user.companyId)
  if (!provider) return NextResponse.json({ error: "No SSO provider configured" }, { status: 404 })

  await takeOwnership(provider.providerId, session.user.id)
  try {
    await auth.api.verifyDomain({
      body: { providerId: provider.providerId },
      headers: await headers(),
    })
  } catch (err) {
    // BAD_GATEWAY only means a missing or stale TXT record, so DNS propagation is named; other errors pass through.
    if (isAPIError(err) && err.status === "BAD_GATEWAY") {
      return NextResponse.json(
        { error: "The DNS record was not found yet. Propagation can take up to an hour." },
        { status: 409 }
      )
    }
    if (isAPIError(err)) {
      return NextResponse.json({ error: err.body?.message ?? err.message }, { status: err.statusCode })
    }
    throw err
  }

  await writeAudit(prisma, {
    companyId: session.user.companyId,
    actorUserId: session.user.id,
    action: AUDIT_ACTIONS.SSO_DOMAIN_VERIFY,
    targetType: "sso_provider",
    targetId: provider.providerId,
    after: { domain: provider.domain, domainVerified: true },
  })

  return NextResponse.json({ domainVerified: true })
}
