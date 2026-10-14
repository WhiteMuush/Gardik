import { prisma } from "@/lib/prisma"
import { ssoEncryption } from "@/lib/sso/encryption"

// Better Auth's only DB client, whose extension encrypts the SSO client secret without changing the `prisma` type.
export const authPrisma = prisma.$extends(ssoEncryption)
