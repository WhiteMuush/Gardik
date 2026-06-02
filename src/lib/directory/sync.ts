import { prisma } from "@/lib/prisma"
import { decryptConfig } from "./crypto"
import { fetchAzureUsers } from "./azure"
import { fetchGoogleUsers } from "./google"
import { fetchLDAPUsers } from "./ldap"
import { fetchAWSUsers } from "./aws"
import type { AzureADConfig, GoogleWorkspaceConfig, LDAPConfig, AWSDirectoryConfig, DirectoryUser } from "./types"

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
    default:
      throw new Error(`Unknown directory type: ${type}`)
  }
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
      data: {
        status: "ERROR",
        errorMessage: (e as Error).message,
        updatedAt: new Date(),
      },
    })
    throw e
  }

  let synced = 0
  for (const user of users) {
    await prisma.employee.upsert({
      where: { email_companyId: { email: user.email, companyId } },
      update: {
        firstName: user.firstName,
        lastName: user.lastName,
        ...(user.department !== undefined ? { department: user.department } : {}),
      },
      create: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        department: user.department,
        companyId,
      },
    })
    synced++
  }

  await prisma.directoryConnection.update({
    where: { id: connectionId },
    data: {
      status: "ACTIVE",
      lastSyncAt: new Date(),
      lastSyncCount: synced,
      errorMessage: null,
    },
  })

  return { synced }
}
