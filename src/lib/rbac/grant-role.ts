import { NextResponse } from "next/server"
import { assertStepUp } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { getUserPermissions } from "./authorize"
import { excessPermissions } from "./escalation"
import { containsCrownJewel } from "./crown-jewels"

// The one rule set for granting a role, shared by reassignment and account creation; returns the refusal or null.
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

  // A crown-jewel role needs proof the session is still in the right hands, not just that it once signed in.
  if (containsCrownJewel(role.permissions)) return assertStepUp(actor.id)

  return null
}
