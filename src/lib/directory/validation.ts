import { randomUUID } from "crypto"
import type { DirectoryType, ConnectStatus } from "@prisma/client"
import { encryptConfig } from "./crypto"

// Required config fields per connection type (SCIM is generated server-side).
export const REQUIRED_FIELDS: Record<string, string[]> = {
  AZURE_AD: ["tenantId", "clientId", "clientSecret"],
  GOOGLE_WORKSPACE: ["serviceAccountEmail", "privateKey", "delegatedAdminEmail", "domain"],
  LDAP: ["host", "port", "bindDN", "bindPassword", "baseDN"],
  AWS_DIRECTORY: ["accessKeyId", "secretAccessKey", "region", "identityStoreId"],
  OKTA: ["domain", "apiToken"],
  SCIM: [],
}

export interface DirectoryInput {
  type?: string
  name?: string
  config?: Record<string, unknown>
}

export interface BuiltConnection {
  data: {
    type: DirectoryType
    name: string
    encryptedConfig: string
    status: ConnectStatus
  }
  bearerToken?: string
}

export type ValidationResult =
  | { ok: false; error: string }
  | { ok: true; built: BuiltConnection }

// Validates raw POST input and builds the persistable connection payload
// (including config encryption), so the route handler stays thin and the
// logic is unit-testable without an HTTP request.
export function buildDirectoryConnection(input: DirectoryInput): ValidationResult {
  const { type, name, config } = input

  if (!type || !name?.trim()) return { ok: false, error: "Missing fields" }
  if (!(type in REQUIRED_FIELDS)) return { ok: false, error: `Invalid type: ${type}` }

  const missing = REQUIRED_FIELDS[type].filter((k) => !config?.[k])
  if (missing.length)
    return { ok: false, error: `Missing config fields: ${missing.join(", ")}` }

  const isSCIM = type === "SCIM"
  const bearerToken = isSCIM ? randomUUID() : undefined
  const finalConfig = isSCIM ? { bearerToken } : (config ?? {})

  return {
    ok: true,
    built: {
      data: {
        type: type as DirectoryType,
        name: name.trim(),
        encryptedConfig: encryptConfig(finalConfig),
        status: isSCIM ? "ACTIVE" : "PENDING",
      },
      bearerToken,
    },
  }
}
