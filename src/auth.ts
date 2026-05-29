import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { company: true },
        })

        if (!user) return null

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.hashedPassword
        )
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.company.name,
          companyId: user.companyId,
          role: user.role,
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
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
})
