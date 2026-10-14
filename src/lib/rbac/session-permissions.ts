import { cache } from "react"
import { prisma } from "@/lib/prisma"
import { getUserPermissions } from "./authorize"

// Cached per request so the layout and the page share one query, keeping authorize.ts pure for unit tests.
export const permissionsForRole = cache((roleId: string | null) => getUserPermissions(prisma, roleId))
