import { prisma } from "@/lib/prisma"
import { decryptConfig } from "./crypto"
import { fetchAzureUsers } from "./azure"
import { fetchGoogleUsers } from "./google"
import { fetchLDAPUsers } from "./ldap"
import { fetchAWSUsers } from "./aws"
import { fetchOktaUsers } from "./okta"
import type {
  AzureADConfig,
  GoogleWorkspaceConfig,
  LDAPConfig,
  AWSDirectoryConfig,
  OktaConfig,
  DirectoryUser,
} from "./types"

const BATCH_SIZE = 25 // caps write concurrency so the connection pool is not exhausted

async function getUsersForConnection(
  type: string,
  encryptedConfig: string
): Promise<DirectoryUser[]> {
  switch (type) {
    case "AZURE_AD":
      return fetchAzureUsers(decryptConfig<AzureADConfig>(encryptedConfig))
    case "GOOGLE_WORKSPACE":
      return fetchGoogleUsers(decryptConfig<GoogleWorkspaceConfig>(encryptedConfig))
    case "LDAP":
      return fetchLDAPUsers(decryptConfig<LDAPConfig>(encryptedConfig))
    case "AWS_DIRECTORY":
      return fetchAWSUsers(decryptConfig<AWSDirectoryConfig>(encryptedConfig))
    case "OKTA":
      return fetchOktaUsers(decryptConfig<OktaConfig>(encryptedConfig))
    case "SCIM":
      throw new Error("SCIM connections are push-based: your IdP triggers the sync.")
    default:
      throw new Error(`Unknown directory type: ${type}`)
  }
}

// Only updates the fields actually supplied, so existing data is never overwritten with "".
function buildUpdate(user: DirectoryUser): Record<string, string | boolean> {
  const update: Record<string, string | boolean> = {}
  if (user.firstName) update.firstName = user.firstName
  if (user.lastName) update.lastName = user.lastName
  if (user.department !== undefined) update.department = user.department
  if (user.mfaEnabled !== undefined) update.mfaEnabled = user.mfaEnabled
  return update
}

function upsertEmployee(user: DirectoryUser, companyId: string) {
  return prisma.employee.upsert({
    where: { email_companyId: { email: user.email, companyId } },
    update: buildUpdate(user),
    create: {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department,
      mfaEnabled: user.mfaEnabled,
      companyId,
    },
  })
}

export async function syncDirectoryConnection(
  connectionId: string,
  companyId: string
): Promise<{ synced: number }> {
  const connection = await prisma.directoryConnection.findFirst({
    where: { id: connectionId, companyId },
  })
  if (!connection) throw new Error("Connection not found")

  let users: DirectoryUser[]
  try {
    users = await getUsersForConnection(connection.type, connection.encryptedConfig)
  } catch (e: unknown) {
    await prisma.directoryConnection.update({
      where: { id: connectionId },
      data: { status: "ERROR", errorMessage: (e as Error)?.message ?? "Unknown error" },
    })
    throw e
  }

  // Bounded batches rather than one sequential round-trip per user.
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    await Promise.all(users.slice(i, i + BATCH_SIZE).map((u) => upsertEmployee(u, companyId)))
  }

  await prisma.directoryConnection.update({
    where: { id: connectionId },
    data: {
      status: "ACTIVE",
      lastSyncAt: new Date(),
      lastSyncCount: users.length,
      errorMessage: null,
    },
  })

  return { synced: users.length }
}
