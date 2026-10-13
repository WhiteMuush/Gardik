import { afterAll, vi } from "vitest"
import bcrypt from "bcryptjs"
import { convertSetCookieToCookie } from "better-auth/test"
import { APIError } from "better-auth/api"
import { prisma } from "@/lib/prisma"
import { authPrisma } from "@/lib/auth/prisma"
import { auth } from "@/lib/auth/server"
import { seedPresetsForCompany, resolvePresetRoleId } from "@/lib/rbac/seed-roles"

export const PROVIDER_ID = "itest-sso-provider"

// Drops this suite's own providers and throwaway companies, never another parallel suite's.
export function ssoCleanup(own: { ids?: string[]; prefix?: string }): string[] {
  const throwawayCompanyIds: string[] = []
  afterAll(async () => {
    if (own.ids) await prisma.ssoProvider.deleteMany({ where: { providerId: { in: own.ids } } })
    if (own.prefix) await prisma.ssoProvider.deleteMany({ where: { providerId: { startsWith: own.prefix } } })
    await prisma.company.deleteMany({ where: { id: { in: throwawayCompanyIds } } })
  })
  return throwawayCompanyIds
}

// Signs in through the real request path, so later auth.api calls carry a session through the same hooks.before.
export async function signInAndGetCookieHeaders(email: string, password: string): Promise<Headers> {
  const response = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  })
  return convertSetCookieToCookie(response.headers)
}

// registerSSOProvider would fetch live OIDC discovery, so only that call is stubbed with the equivalent row insert.
export async function stubProviderRegistration(ownerId: string) {
  return vi.spyOn(auth.api, "registerSSOProvider").mockImplementation(async (args) => {
    if (!args) throw new Error("registerSSOProvider stub called without args")
    if (!args) throw new Error("registerSSOProvider stub called without args")
    const body = args.body as {
      providerId: string
      issuer: string
      domain: string
      oidcConfig: Record<string, unknown>
    }
    await authPrisma.ssoProvider.create({
      data: {
        providerId: body.providerId,
        issuer: body.issuer,
        domain: body.domain,
        domainVerified: false,
        oidcConfig: JSON.stringify(body.oidcConfig),
        userId: ownerId,
      },
    })
    return { providerId: body.providerId } as Awaited<ReturnType<typeof auth.api.registerSSOProvider>>
  })
}

// Users, accounts, sessions, roles and audit rows all cascade from the company the caller tracks.
export async function setupCompanyWithViewerAndAdmin(label: string, throwawayCompanyIds: string[]) {
  const company = await prisma.company.create({
    data: { name: `${label} Co`, domain: `${label}-${Date.now()}.test` },
  })
  throwawayCompanyIds.push(company.id)
  await seedPresetsForCompany(prisma, company.id)
  const viewerRoleId = await resolvePresetRoleId(prisma, company.id, "Viewer")
  const administratorRoleId = await resolvePresetRoleId(prisma, company.id, "Administrator")

  const password = "CorrectHorse1!"
  const hashedPassword = await bcrypt.hash(password, 10)

  const viewerEmail = `${label}-viewer-${Date.now()}@test.local`
  const viewerUser = await prisma.user.create({
    data: { email: viewerEmail, companyId: company.id, roleId: viewerRoleId, emailVerified: true },
  })
  await prisma.account.create({
    data: {
      accountId: viewerUser.id,
      providerId: "credential",
      userId: viewerUser.id,
      password: hashedPassword,
    },
  })

  const adminEmail = `${label}-admin-${Date.now()}@test.local`
  const adminUser = await prisma.user.create({
    data: { email: adminEmail, companyId: company.id, roleId: administratorRoleId, emailVerified: true },
  })
  await prisma.account.create({
    data: {
      accountId: adminUser.id,
      providerId: "credential",
      userId: adminUser.id,
      password: hashedPassword,
    },
  })

  const viewerHeaders = await signInAndGetCookieHeaders(viewerEmail, password)
  const adminHeaders = await signInAndGetCookieHeaders(adminEmail, password)

  return { company, viewerUser, adminUser, viewerHeaders, adminHeaders }
}

export function jsonRequest(method: string, body?: unknown): Request {
  return new Request("http://localhost/api/sso/provider", {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

// verifyDomain would run a live DNS lookup, so tests stub it to reject with the plugin's real error shapes.
export const badGatewayError = () =>
  new APIError("BAD_GATEWAY", {
    message: "Unable to verify domain ownership for example.com. Try again later",
    code: "DOMAIN_VERIFICATION_FAILED",
  })
export const conflictError = () =>
  new APIError("CONFLICT", {
    message: "Domain has already been verified",
    code: "DOMAIN_VERIFIED",
  })

export function resolveRequest(email: string): Request {
  return new Request("http://localhost/api/sso/resolve", {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}
