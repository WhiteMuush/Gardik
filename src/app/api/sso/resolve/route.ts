import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rateLimit"

const NO_SSO = { sso: false } as const

// Unauthenticated by necessity: it runs before sign-in. The company is resolved
// from the User row rather than from the typed domain, so a company cannot
// capture another company's users by claiming its domain. An unverified provider
// answers like no provider at all: signing in with it would fail at the callback
// anyway, and this keeps the failure on our side where the message is readable.
export async function POST(req: Request) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string }
  if (!email || typeof email !== "string") return NextResponse.json(NO_SSO)

  const allowed = await rateLimit(`sso-resolve:${email.toLowerCase()}`, 10, 60_000)
  if (!allowed) return NextResponse.json(NO_SSO, { status: 429 })

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { companyId: true },
  })
  if (!user) return NextResponse.json(NO_SSO)

  const provider = await prisma.ssoProvider.findFirst({
    where: { organizationId: user.companyId, domainVerified: true },
    select: { providerId: true },
  })
  if (!provider) return NextResponse.json(NO_SSO)

  return NextResponse.json({ sso: true, providerId: provider.providerId })
}
