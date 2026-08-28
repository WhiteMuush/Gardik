import {
  IdentitystoreClient,
  ListUsersCommand,
  DescribeUserCommand,
} from "@aws-sdk/client-identitystore"
import type { AWSDirectoryConfig, DirectoryUser, TestResult } from "./types"

function getClient(config: AWSDirectoryConfig) {
  return new IdentitystoreClient({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
}

export async function fetchAWSUsers(config: AWSDirectoryConfig): Promise<DirectoryUser[]> {
  const client = getClient(config)
  const users: DirectoryUser[] = []
  let nextToken: string | undefined

  do {
    const res = await client.send(
      new ListUsersCommand({
        IdentityStoreId: config.identityStoreId,
        NextToken: nextToken,
        MaxResults: 100,
      })
    )

    for (const u of res.Users ?? []) {
      const email =
        u.Emails?.find((e) => e.Primary)?.Value ??
        u.Emails?.[0]?.Value ??
        u.UserName
      if (!email) continue

      users.push({
        email: email.toLowerCase(),
        firstName: u.Name?.GivenName ?? "",
        lastName: u.Name?.FamilyName ?? "",
        department: undefined,
      })
    }

    nextToken = res.NextToken
  } while (nextToken)

  return users
}

export async function testAWSConnection(config: AWSDirectoryConfig): Promise<TestResult> {
  try {
    const client = getClient(config)
    const res = await client.send(
      new ListUsersCommand({
        IdentityStoreId: config.identityStoreId,
        MaxResults: 1,
      })
    )
    // ListUsers doesn't return a total count, so fetch one page to verify access
    void DescribeUserCommand
    return { ok: true, userCount: res.Users?.length ?? 0 }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
