import { timingSafeEqual } from "crypto"
import { prisma } from "@/lib/prisma"
import { decryptConfig } from "@/lib/directory/crypto"
import { rateLimit } from "@/lib/rateLimit"
import type { SCIMConfig } from "@/lib/directory/types"

const SCIM_RATE_LIMIT = 120
const SCIM_RATE_WINDOW_MS = 60_000

// Throttle inbound SCIM requests per connection, before token validation, so
// an unauthenticated caller cannot brute-force tokens or flood the endpoint.
// Returns true when the request is allowed. In-memory and per-instance (see
// rateLimit); move to a shared store when scaling horizontally.
export function checkScimRateLimit(connectionId: string): boolean {
  return rateLimit(`scim:${connectionId}`, SCIM_RATE_LIMIT, SCIM_RATE_WINDOW_MS)
}

// Comparaison à temps constant pour neutraliser les attaques temporelles sur le token.
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

// Authentifie une requête SCIM entrante via le bearer token de la connexion.
// Renvoie le companyId associé, ou null (jamais d'exception) pour répondre 401.
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
    return null // config illisible : 401 plutôt que 500
  }
}
