import { cache } from "react"
import { prisma } from "@/lib/prisma"
import { getUserPermissions } from "./authorize"

/**
 * The caller's permissions, resolved once per request.
 *
 * The dashboard layout resolves them for the rail, and every page below it
 * resolves them again for its own gating: same role, same request, two queries.
 * Twelve pages did this. getUserPermissions itself says the memoizing belongs
 * to its callers, so it lives here rather than in the authorize module, which
 * stays a pure function the unit tests can call without a request around it.
 */
export const permissionsForRole = cache((roleId: string | null) =>
  getUserPermissions(prisma, roleId)
)
