import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"
import { buildCsp } from "@/lib/csp"

export default function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isLogin = path === "/login" || path.startsWith("/login/")
  const hasSession = getSessionCookie(req) !== null

  if (!hasSession && !isLogin) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const nonce = btoa(crypto.randomUUID())
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development")

  // Next.js reads the nonce from the request CSP header and stamps it on
  // its own inline scripts; without this the response header would block them.
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
