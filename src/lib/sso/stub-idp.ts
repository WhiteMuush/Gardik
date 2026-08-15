import { createServer, type Server } from "node:http"
import { generateKeyPair, exportJWK, SignJWT, type JWK } from "jose"

// Test-only OIDC identity provider: discovery document, JWKS, and a token
// endpoint. Signs a real RS256 id_token so the plugin's signature and issuer
// checks in round-trip.itest.ts run for real, not against a mock. Binds to
// 127.0.0.1 on an OS-assigned port so it never touches DNS or the public
// internet; src/lib/auth/server.ts allowlists that loopback range in
// trustedOrigins only when NODE_ENV is "test", which is what lets the
// plugin's discovery/token/jwks fetches reach it at all (see the comment
// there for why that check exists and stays production-only otherwise).
//
// The /authorize endpoint below is never actually fetched: this stub is
// driven by calling the plugin's callback handler directly with a code
// minted by issueCode(), not by following a real browser redirect. It exists
// only so the discovery document's authorization_endpoint points somewhere
// real.
export async function startStubIdp() {
  const { publicKey, privateKey } = await generateKeyPair("RS256")
  const jwk = (await exportJWK(publicKey)) as JWK
  jwk.kid = "stub-key"
  jwk.alg = "RS256"

  const codes = new Map<string, { email: string; sub: string }>()
  const clientId = "stub-client"
  const clientSecret = "stub-secret"

  let issuer = ""
  const server: Server = createServer(async (req, res) => {
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
  })

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  const port = typeof address === "object" && address ? address.port : 0
  issuer = `http://127.0.0.1:${port}`

  return {
    issuer,
    discoveryEndpoint: `${issuer}/.well-known/openid-configuration`,
    clientId,
    clientSecret,
    // Mints a one-time authorization code the token endpoint will exchange
    // for the given email/sub. Mirrors what a real IdP hands back after the
    // user authenticates at /authorize; the test calls this directly since
    // nothing here drives a real browser through that redirect.
    issueCode(email: string, sub: string): string {
      const code = `code-${Math.random().toString(36).slice(2)}`
      codes.set(code, { email, sub })
      return code
    },
    close: (): Promise<void> => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}
