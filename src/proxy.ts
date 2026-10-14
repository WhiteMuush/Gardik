import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"
import { buildCsp } from "@/lib/csp"

// Pages open to signed-out visitors, /invite included since its single-use token is the authorization.
function isPublicPage(path: string): boolean {
  return ["/login", "/invite"].some((p) => path === p || path.startsWith(`${p}/`))
}

export default function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const hasSession = getSessionCookie(req) !== null

  if (!hasSession && !isPublicPage(path)) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const nonce = btoa(crypto.randomUUID())
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development")

  // Next reads the nonce from the request CSP header and stamps its own inline scripts with it.
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("content-security-policy", csp)
  requestHeaders.set("x-pathname", path)

  const res = NextResponse.next({ request: { headers: requestHeaders } })
  res.headers.set("Content-Security-Policy", csp)
  return res
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|fonts|.*\\..*).*)"],
}
