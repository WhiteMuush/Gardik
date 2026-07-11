import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname
      if (path === "/login" || path.startsWith("/login/")) return true
      return !!auth?.user
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.companyId = user.companyId
        token.role = user.role
      }
      return token
    },
    session({ session, token }) {
      session.user.id = (token.id ?? token.sub) as string
      session.user.companyId = token.companyId as string
      session.user.role = token.role as "ADMIN" | "VIEWER"
      return session
    },
  },
  providers: [],
}
