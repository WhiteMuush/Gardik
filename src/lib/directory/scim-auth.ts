import { timingSafeEqual } from "crypto"
import { prisma } from "@/lib/prisma"
import { decryptConfig } from "@/lib/directory/crypto"
import { rateLimit } from "@/lib/rateLimit"
import type { SCIMConfig } from "@/lib/directory/types"

const SCIM_RATE_LIMIT = 120
const SCIM_RATE_WINDOW_MS = 60_000

// Throttle inbound SCIM requests per connection, before token validation, so
// an unauthenticated caller cannot brute-force tokens or flood the endpoint.
// Returns true when the request is allowed. Shared across instances, see
// rateLimit.
export function checkScimRateLimit(connectionId: string): Promise<boolean> {
  return rateLimit(`scim:${connectionId}`, SCIM_RATE_LIMIT, SCIM_RATE_WINDOW_MS)
}

// Constant-time comparison, so a timing attack cannot recover the token.
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

// Authenticates an inbound SCIM request against the connection's bearer token.
// Returns the matching companyId, or null (never a throw) so the caller answers 401.
export async function authenticateScim(
  req: Request,
  connectionId: string
): Promise<{ companyId: string } | null> {
  const token = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(\S.*)$/i)?.[1]
  if (!token) return null

  const conn = await prisma.directoryConnection.findFirst({
    where: { id: connectionId, type: "SCIM" },
    select: { encryptedConfig: true, companyId: true },
  })
  if (!conn) return null

  try {
    const config = decryptConfig<SCIMConfig>(conn.encryptedConfig)
    return safeEqual(config.bearerToken, token) ? { companyId: conn.companyId } : null
  } catch {
    return null // unreadable config: answer 401 rather than 500
  }
}
