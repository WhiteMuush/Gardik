import { Prisma } from "@prisma/client"
import { encryptConfig, decryptConfig } from "@/lib/directory/crypto"

// The plugin stores oidcConfig as a JSON string carrying the client secret.
// encryptConfig works on objects, so the string travels wrapped.
export function sealOidcConfig(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  return encryptConfig({ v: raw })
}

export function openOidcConfig(sealed: string | null | undefined): string | null {
  if (sealed === null || sealed === undefined) return null
  return decryptConfig<{ v: string }>(sealed).v
}

type Row = { oidcConfig?: string | null }

function sealArgs(args: unknown): unknown {
  if (!args || typeof args !== "object") return args
  const a = args as Record<string, unknown>
  for (const key of ["data", "create", "update"]) {
    const section = a[key]
    if (!section || typeof section !== "object") continue
    const row = section as Record<string, unknown>
    if (typeof row.oidcConfig === "string") row.oidcConfig = sealOidcConfig(row.oidcConfig)
  }
  return a
}

function openResult<T>(result: T): T {
  if (Array.isArray(result)) return result.map((row) => openResult(row)) as T
  if (!result || typeof result !== "object") return result
  const row = result as Row
  if (typeof row.oidcConfig === "string") row.oidcConfig = openOidcConfig(row.oidcConfig)
  return result
}

// Scoped to the ssoProvider model only. Applied to the client Better Auth uses,
// never to the app-wide client, so the extension cannot change types elsewhere.
export const ssoEncryption = Prisma.defineExtension({
  name: "sso-oidc-config-encryption",
  query: {
    ssoProvider: {
      async $allOperations({ args, query }) {
        return openResult(await query(sealArgs(args) as never))
      },
    },
  },
})
