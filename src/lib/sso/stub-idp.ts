import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import { generateKeyPair, exportJWK, SignJWT, type JWK } from "jose"

// Test-only OIDC provider on loopback signing real RS256 tokens; server.ts trusts loopback only under NODE_ENV=test.
export async function startStubIdp() {
  const { publicKey, privateKey } = await generateKeyPair("RS256")
  const jwk = (await exportJWK(publicKey)) as JWK
  jwk.kid = "stub-key"
  jwk.alg = "RS256"

  const codes = new Map<string, { email: string; sub: string }>()
  const clientId = "stub-client"
  const clientSecret = "stub-secret"

  let issuer = ""
  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", issuer)
    if (url.pathname === "/.well-known/openid-configuration") {
      res.setHeader("content-type", "application/json")
      res.end(
        JSON.stringify({
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          jwks_uri: `${issuer}/jwks`,
          response_types_supported: ["code"],
          subject_types_supported: ["public"],
          id_token_signing_alg_values_supported: ["RS256"],
        })
      )
      return
    }
    if (url.pathname === "/jwks") {
      res.setHeader("content-type", "application/json")
      res.end(JSON.stringify({ keys: [jwk] }))
      return
    }
    if (url.pathname === "/token") {
      const body = await new Promise<string>((resolve) => {
        let raw = ""
        req.on("data", (c) => (raw += c))
        req.on("end", () => resolve(raw))
      })
      const code = new URLSearchParams(body).get("code") ?? ""
      const claims = codes.get(code)
      if (!claims) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: "invalid_grant" }))
        return
      }
      const idToken = await new SignJWT({ email: claims.email, name: claims.email })
        .setProtectedHeader({ alg: "RS256", kid: "stub-key" })
        .setIssuer(issuer)
        .setAudience(clientId)
        .setSubject(claims.sub)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(privateKey)
      res.setHeader("content-type", "application/json")
      res.end(JSON.stringify({ access_token: "stub-access", id_token: idToken, token_type: "Bearer" }))
      return
    }
    res.statusCode = 404
    res.end()
  }
  const server: Server = createServer((req, res) => void handle(req, res))

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  const port = typeof address === "object" && address ? address.port : 0
  issuer = `http://127.0.0.1:${port}`

  return {
    issuer,
    discoveryEndpoint: `${issuer}/.well-known/openid-configuration`,
    clientId,
    clientSecret,
    // Mints the code a real IdP would return after /authorize, which no browser drives here.
    issueCode(email: string, sub: string): string {
      const code = `code-${Math.random().toString(36).slice(2)}`
      codes.set(code, { email, sub })
      return code
    },
    close: (): Promise<void> => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}
