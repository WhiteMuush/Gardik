import { timingSafeEqual } from "crypto"
import { prisma } from "@/lib/prisma"
import { decryptConfig } from "@/lib/directory/crypto"
import type { SCIMConfig } from "@/lib/directory/types"

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
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
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
