import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rateLimit"

const NO_SSO = { sso: false } as const

// Unauthenticated by necessity: it runs before sign-in, so the login page can
// tell whether to ask for a password or send the visitor to their identity
// provider.
//
// The answer is derived from the address's domain alone, never from whether an
// account exists. Resolving through the User row (as this did) turned the login
// form into an account directory: anyone could type addresses and read
// "sso: true" as "this person has an account here", for every company running a
// verified provider. Rate limiting slowed that down; it did not stop it.
//
// A domain reveals nothing personal, and answering from it is safe because a
// provider only counts once domainVerified is set, which requires proving
// control of the domain through DNS. A company cannot capture another company's
// users by claiming a domain it does not own.
export async function POST(req: Request) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string }
  if (!email || typeof email !== "string") return NextResponse.json(NO_SSO)

  const allowed = await rateLimit(`sso-resolve:${email.toLowerCase()}`, 10, 60_000)
  if (!allowed) return NextResponse.json(NO_SSO, { status: 429 })

  const domain = email.toLowerCase().split("@")[1]
  if (!domain) return NextResponse.json(NO_SSO)

  // Two verified providers on one domain is not a routing decision this
  // endpoint should improvise: sending someone to the wrong company's identity
  // provider is worse than asking them for a password. take: 2 is enough to
  // notice the ambiguity without reading every row.
  const providers = await prisma.ssoProvider.findMany({
    where: { domain, domainVerified: true },
    select: { providerId: true },
    take: 2,
  })
  if (providers.length !== 1) return NextResponse.json(NO_SSO)

  return NextResponse.json({ sso: true, providerId: providers[0].providerId })
}
