import type { ReactElement } from "react"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { getUserPermissions, authorize } from "./authorize"
import type { Permission } from "./permissions"
import { NoAccess } from "@/components/layout/NoAccess"

/**
 * Refuses a dashboard page to a role that does not hold its permission.
 *
 * Must be awaited as the first statement of the page, before any query. The
 * layout also checks, but a layout cannot prevent the page from running: Next
 * renders both, so a page that fetches first and is hidden afterwards has
 * already put the company's data in the response. Measured, not assumed: with
 * only the layout check in place, a role without employees:read still received
 * every employee address in the HTML of /employees.
 *
 * Returns the refusal to render, or null when the caller may proceed:
 *
 *   const denied = await guardPage("employees:read")
 *   if (denied) return denied
 */
export async function guardPage(permission: Permission): Promise<ReactElement | null> {
  const session = await getSession()
  if (!session) return NoAccess()

  const perms = await getUserPermissions(prisma, session.user.roleId ?? null)
  return authorize(perms, permission) ? null : NoAccess()
}
