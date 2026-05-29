import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      companyId: string
      role: "ADMIN" | "VIEWER"
    } & DefaultSession["user"]
  }

  interface User {
    companyId: string
    role: "ADMIN" | "VIEWER"
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    companyId: string
    role: "ADMIN" | "VIEWER"
  }
}
