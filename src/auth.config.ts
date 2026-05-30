import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user
    },
    jwt({ token, user }) {
      if (user) {
        token.companyId = user.companyId
        token.role = user.role
      }
      return token
    },
    session({ session, token }) {
      session.user.companyId = token.companyId as string
      session.user.role = token.role as "ADMIN" | "VIEWER"
      return session
    },
  },
  providers: [],
}
