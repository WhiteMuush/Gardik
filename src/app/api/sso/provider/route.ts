import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { requirePermission } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth/server"
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"
import { findCompanyProvider, maskedProvider, takeOwnership } from "@/lib/sso/provider"

type Body = {
  issuer?: string
  domain?: string
  clientId?: string
  clientSecret?: string
  discoveryEndpoint?: string
}

function httpsUrl(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" ? url.toString() : null
  } catch {
    return null
  }
}

export async function GET() {
  const { session, error } = await requirePermission("sso:read")
  if (error) return error
  const provider = await findCompanyProvider(session.user.companyId)
  return NextResponse.json({ provider: provider ? maskedProvider(provider) : null })
}

export async function POST(req: Request) {
  const { session, error } = await requirePermission("sso:config")
  if (error) return error

  const body = (await req.json()) as Body
  const issuer = httpsUrl(body.issuer)
  const discoveryEndpoint = httpsUrl(body.discoveryEndpoint)
  if (!issuer || !discoveryEndpoint) {
    return NextResponse.json({ error: "issuer and discoveryEndpoint must be https URLs" }, { status: 400 })
  }
  if (!body.domain || !body.clientId || !body.clientSecret) {
    return NextResponse.json({ error: "domain, clientId and clientSecret are required" }, { status: 400 })
  }
  if (await findCompanyProvider(session.user.companyId)) {
    return NextResponse.json({ error: "This company already has an SSO provider" }, { status: 409 })
  }

  const providerId = `sso-${session.user.companyId}`

  // Registered without organizationId on purpose: the plugin looks up a `member`
  // row whenever the body carries one, and that query is not guarded by
  // hasPlugin("organization"). Our schema has no such model, so it would throw.
  await auth.api.registerSSOProvider({
    body: {
      providerId,
      issuer,
      domain: body.domain,
      oidcConfig: {
        clientId: body.clientId,
        clientSecret: body.clientSecret,
        discoveryEndpoint,
        pkce: true,
        scopes: ["openid", "email", "profile"],
      },
    },
    headers: await headers(),
  })

  await prisma.ssoProvider.update({
    where: { providerId },
    data: { organizationId: session.user.companyId, userId: session.user.id },
  })

  await writeAudit(prisma, {
    companyId: session.user.companyId,
    actorUserId: session.user.id,
    action: AUDIT_ACTIONS.SSO_PROVIDER_CREATE,
    targetType: "sso_provider",
    targetId: providerId,
    after: { issuer, domain: body.domain, discoveryEndpoint },
  })

  const created = await findCompanyProvider(session.user.companyId)
  return NextResponse.json({ provider: created ? maskedProvider(created) : null }, { status: 201 })
}

export async function PATCH(req: Request) {
  const { session, error } = await requirePermission("sso:config")
  if (error) return error

  const current = await findCompanyProvider(session.user.companyId)
  if (!current) return NextResponse.json({ error: "No SSO provider configured" }, { status: 404 })

  const body = (await req.json()) as Body
  const issuer = body.issuer ? httpsUrl(body.issuer) : current.issuer
  const discoveryEndpoint = body.discoveryEndpoint ? httpsUrl(body.discoveryEndpoint) : undefined
  if (!issuer || (body.discoveryEndpoint && !discoveryEndpoint)) {
    return NextResponse.json({ error: "issuer and discoveryEndpoint must be https URLs" }, { status: 400 })
  }

  await takeOwnership(current.providerId, session.user.id)
  await auth.api.updateSSOProvider({
    body: {
      providerId: current.providerId,
      issuer,
      ...(body.domain ? { domain: body.domain } : {}),
      oidcConfig: {
        ...(body.clientId ? { clientId: body.clientId } : {}),
        ...(body.clientSecret ? { clientSecret: body.clientSecret } : {}),
        ...(discoveryEndpoint ? { discoveryEndpoint } : {}),
      },
    },
    headers: await headers(),
  })

  await writeAudit(prisma, {
    companyId: session.user.companyId,
    actorUserId: session.user.id,
    action: AUDIT_ACTIONS.SSO_PROVIDER_UPDATE,
    targetType: "sso_provider",
    targetId: current.providerId,
    before: maskedProvider(current),
    after: { issuer, domain: body.domain ?? current.domain },
  })

  const updated = await findCompanyProvider(session.user.companyId)
  return NextResponse.json({ provider: updated ? maskedProvider(updated) : null })
}

export async function DELETE() {
  const { session, error } = await requirePermission("sso:config")
  if (error) return error

  const current = await findCompanyProvider(session.user.companyId)
  if (!current) return NextResponse.json({ error: "No SSO provider configured" }, { status: 404 })

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: session.user.companyId },
    select: { ssoMandatory: true },
  })
  if (company.ssoMandatory) {
    return NextResponse.json(
      { error: "Turn off the SSO mandatory policy before removing the provider" },
      { status: 409 }
    )
  }

  await prisma.ssoProvider.delete({ where: { providerId: current.providerId } })
  await writeAudit(prisma, {
    companyId: session.user.companyId,
    actorUserId: session.user.id,
    action: AUDIT_ACTIONS.SSO_PROVIDER_DELETE,
    targetType: "sso_provider",
    targetId: current.providerId,
    before: maskedProvider(current),
  })
  return NextResponse.json({ ok: true })
}
