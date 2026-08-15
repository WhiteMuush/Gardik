import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/apiAuth"
import { rateLimit } from "@/lib/rateLimit"
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
  const { session, error } = await requirePermission("connectors:sync")
  if (error) return error

  // Each call opens a connection to somebody else's directory (LDAP, Azure,
  // Okta). Spamming it turns this endpoint into a way to hammer a third party
  // from our address, so it is bounded well below the general API ceiling.
  if (!(await rateLimit(`directory-test:${session.user.companyId}`, 10, 60_000))) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 })
  }

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
