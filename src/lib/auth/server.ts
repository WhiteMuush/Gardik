import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { twoFactor } from "better-auth/plugins"
import { nextCookies } from "better-auth/next-js"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    password: {
      hash: (password) => bcrypt.hash(password, 10),
      verify: ({ hash, password }) => bcrypt.compare(password, hash),
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", input: false },
      companyId: { type: "string", input: false },
    },
  },
  plugins: [twoFactor(), nextCookies()],
})
