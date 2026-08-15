import { NextResponse } from "next/server"
import { assertStepUp } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { getUserPermissions } from "./authorize"
import { excessPermissions } from "./escalation"
import { containsCrownJewel } from "./crown-jewels"

/**
 * The rules for handing somebody a role, in one place.
 *
 * They existed only inside the role-reassignment route, and the route that
 * creates a pre-provisioned account checked neither: it accepted any role of
 * the company marked assignable, Administrator included. A holder of
 * users:manage could therefore create an account more powerful than their own
 * and take it over through the invitation flow, which is precisely what the
 * no-escalation rule exists to prevent. Two routes decide the same thing, so
 * they now ask the same function rather than each carrying their own copy.
 *
 * Returns the refusal to send back, or null when the grant is allowed.
 */
export async function assertMayGrantRole(
  actor: { id: string; roleId?: string | null },
  role: { permissions: string[] }
): Promise<NextResponse | null> {
  // No-escalation: nobody hands out a permission they do not hold themselves.
  const actorPerms = await getUserPermissions(prisma, actor.roleId ?? null)
  const excess = excessPermissions(actorPerms, role.permissions)
  if (excess.length > 0) {
    return NextResponse.json({ error: "Exceeds your permissions", excess }, { status: 403 })
  }

  // A role carrying control over who can do what needs proof the session is
  // still in the right hands, not merely that it was at sign-in.
  if (containsCrownJewel(role.permissions)) return assertStepUp(actor.id)

  return null
}
