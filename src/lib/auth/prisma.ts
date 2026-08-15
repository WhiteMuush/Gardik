import { prisma } from "@/lib/prisma"
import { ssoEncryption } from "@/lib/sso/encryption"

// Better Auth reaches the DB through this client only. The extension makes the
// SSO client secret ciphertext at rest without the plugin knowing, and without
// changing the type of the app-wide `prisma` export that every route uses.
export const authPrisma = prisma.$extends(ssoEncryption)
