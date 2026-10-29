import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { permissionsForRole } from "@/lib/rbac/session-permissions"
import { visiblePages } from "@/lib/rbac/page-permissions"
import { parsePreferencesPatch, sanitizePreferences } from "@/lib/preferences/schema"

// Display choices only, so no step-up and no audit row: nothing here grants access or touches company data.
export async function PATCH(req: Request) {
  const { session, error } = await requireAuth()
  if (error) return error

  const parsed = parsePreferencesPatch(await req.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { homePage } = parsed.patch
  if (homePage) {
    const visible = visiblePages(await permissionsForRole(session.user.roleId ?? null))
    if (!visible.includes(homePage)) {
      return NextResponse.json({ error: "Your role cannot open that page" }, { status: 400 })
    }
  }

  const row = await prisma.userPreference.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...parsed.patch },
    update: parsed.patch,
  })
  return NextResponse.json(sanitizePreferences(row))
}
