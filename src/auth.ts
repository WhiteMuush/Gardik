import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "@/auth.config"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rateLimit"
import bcrypt from "bcryptjs"

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        if (!rateLimit(`login:${credentials.email}`, 10, 60_000)) return null

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
})
