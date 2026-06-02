import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { decryptConfig } from "@/lib/directory/crypto"
import { testAzureConnection } from "@/lib/directory/azure"
import { testGoogleConnection } from "@/lib/directory/google"
import { testLDAPConnection } from "@/lib/directory/ldap"
import { testAWSConnection } from "@/lib/directory/aws"
import { testOktaConnection } from "@/lib/directory/okta"
import type { AzureADConfig, GoogleWorkspaceConfig, LDAPConfig, AWSDirectoryConfig, OktaConfig } from "@/lib/directory/types"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Admin only" }, { status: 403 })

  const { id } = await params

  const connection = await prisma.directoryConnection.findFirst({
    where: { id, companyId: session.user.companyId },
  })
  if (!connection) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let result
  switch (connection.type) {
    case "AZURE_AD":
      result = await testAzureConnection(decryptConfig<AzureADConfig>(connection.encryptedConfig))
      break
    case "GOOGLE_WORKSPACE":
      result = await testGoogleConnection(
        decryptConfig<GoogleWorkspaceConfig>(connection.encryptedConfig)
      )
      break
    case "LDAP":
      result = await testLDAPConnection(decryptConfig<LDAPConfig>(connection.encryptedConfig))
      break
    case "AWS_DIRECTORY":
      result = await testAWSConnection(decryptConfig<AWSDirectoryConfig>(connection.encryptedConfig))
      break
    case "OKTA":
      result = await testOktaConnection(decryptConfig<OktaConfig>(connection.encryptedConfig))
      break
    case "SCIM":
      result = { ok: true }
      break
    default:
      result = { ok: false, error: "Unknown type" }
  }

  return NextResponse.json(result)
}
