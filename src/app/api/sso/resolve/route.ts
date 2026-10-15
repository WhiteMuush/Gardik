import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rateLimit"

const NO_SSO = { sso: false } as const

// Public and answered from the domain alone, never from account existence (see the wiki Authentication page).
export async function POST(req: Request) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string }
  if (!email || typeof email !== "string") return NextResponse.json(NO_SSO)

  const allowed = await rateLimit(`sso-resolve:${email.toLowerCase()}`, 10, 60_000)
  if (!allowed) return NextResponse.json(NO_SSO, { status: 429 })

  const domain = email.toLowerCase().split("@")[1]
  if (!domain) return NextResponse.json(NO_SSO)

  // Two verified providers on one domain fall back to a password rather than guessing the company.
  const providers = await prisma.ssoProvider.findMany({
    where: { domain, domainVerified: true },
    select: { providerId: true },
    take: 2,
  })
  const [only, other] = providers
  if (!only || other) return NextResponse.json(NO_SSO)

  return NextResponse.json({ sso: true, providerId: only.providerId })
}
