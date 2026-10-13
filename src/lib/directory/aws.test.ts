import { describe, it, expect, vi, afterEach } from "vitest"
import { IdentitystoreClient, ListUsersCommand } from "@aws-sdk/client-identitystore"
import { fetchAWSUsers, testAWSConnection } from "./aws"

const config = {
  accessKeyId: "AKIAEXAMPLE",
  secretAccessKey: "secret",
  region: "eu-west-3",
  identityStoreId: "d-123",
}

type Page = { Users?: Record<string, unknown>[]; NextToken?: string }

function mockSend(...pages: Page[]) {
  const send = vi.spyOn(IdentitystoreClient.prototype, "send")
  for (const page of pages) send.mockResolvedValueOnce(page as never)
  return send
}

const awsUser = (emails: { Value: string; Primary?: boolean }[] | undefined, userName = "ada") => ({
  UserName: userName,
  Emails: emails,
  Name: { GivenName: "Ada", FamilyName: "Lovelace" },
})

afterEach(() => vi.restoreAllMocks())

describe("fetchAWSUsers", () => {
  it("follows NextToken pages on the configured identity store", async () => {
    const send = mockSend(
      { Users: [awsUser([{ Value: "A@X.com" }])], NextToken: "t2" },
      { Users: [awsUser([{ Value: "b@x.com" }])] }
    )

    const users = await fetchAWSUsers(config)
    expect(users.map((u) => u.email)).toEqual(["a@x.com", "b@x.com"])
    const inputs = send.mock.calls.map(([cmd]) => (cmd as ListUsersCommand).input)
    expect(inputs[0]).toMatchObject({ IdentityStoreId: "d-123", NextToken: undefined })
    expect(inputs[1].NextToken).toBe("t2")
  })

  it("prefers the primary email over the first one", async () => {
    mockSend({ Users: [awsUser([{ Value: "alias@x.com" }, { Value: "main@x.com", Primary: true }])] })
    const [user] = await fetchAWSUsers(config)
    expect(user).toEqual({
      email: "main@x.com",
      firstName: "Ada",
      lastName: "Lovelace",
      department: undefined,
    })
  })

  it("falls back to the user name when it is an email", async () => {
    mockSend({ Users: [awsUser(undefined, "Ada@X.com")] })
    const [user] = await fetchAWSUsers(config)
    expect(user.email).toBe("ada@x.com")
  })

  it("skips users whose only identifier is not an email", async () => {
    mockSend({ Users: [awsUser(undefined, "ada.lovelace")] })
    expect(await fetchAWSUsers(config)).toEqual([])
  })

  it("propagates AWS errors", async () => {
    vi.spyOn(IdentitystoreClient.prototype, "send").mockRejectedValue(new Error("AccessDeniedException"))
    await expect(fetchAWSUsers(config)).rejects.toThrow("AccessDeniedException")
  })
})

describe("testAWSConnection", () => {
  it("lists one user to prove access", async () => {
    const send = mockSend({ Users: [awsUser([{ Value: "a@x.com" }])] })
    expect(await testAWSConnection(config)).toEqual({ ok: true, userCount: 1 })
    expect((send.mock.calls[0][0] as ListUsersCommand).input.MaxResults).toBe(1)
  })

  it("returns the error instead of throwing", async () => {
    vi.spyOn(IdentitystoreClient.prototype, "send").mockRejectedValue(
      new Error("UnrecognizedClientException")
    )
    expect(await testAWSConnection(config)).toEqual({ ok: false, error: "UnrecognizedClientException" })
  })
})
