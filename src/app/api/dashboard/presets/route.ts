import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import type { SavedDashboardConfig } from "@/types/dashboard"
import { getUserPermissions, authorize } from "@/lib/rbac/authorize"

export async function GET() {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 })

  const [presets, user] = await Promise.all([
    prisma.dashboardPreset.findMany({
      where: {
        OR: [
          { userId: session.user.id, scope: "PERSONAL" },
          { companyId: session.user.companyId, scope: "COMPANY" },
        ],
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { activePresetId: true },
    }),
  ])

  return NextResponse.json({ presets, activePresetId: user?.activePresetId ?? null })
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 })

  const body: { name: string; scope?: "PERSONAL" | "COMPANY"; layout?: SavedDashboardConfig["layout"]; widgets?: SavedDashboardConfig["widgets"] } = await req.json()

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  // Narrowed against a literal set before it reaches the guard below. The type
  // annotation on `body` is a compile-time claim about a value that arrives as
  // untrusted JSON, so anything other than the two members used to slip past
  // `scope === "COMPANY"` unchecked and only fail later, on Prisma's enum
  // validation. That made an authorization decision depend on a database
  // constraint several lines away rather than on an explicit check.
  const scope = body.scope ?? "PERSONAL"
  if (scope !== "PERSONAL" && scope !== "COMPANY") {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 })
  }

  if (scope === "COMPANY") {
    const perms = await getUserPermissions(prisma, session.user.roleId ?? null)
    if (!authorize(perms, "dashboard:manage_shared")) {
      return NextResponse.json({ error: "Only admins can create company presets" }, { status: 403 })
    }
  }

  const preset = await prisma.dashboardPreset.create({
    data: {
      name: body.name.trim(),
      scope,
      userId: scope === "PERSONAL" ? session.user.id : null,
      companyId: session.user.companyId,
      layout: body.layout ?? [],
      widgets: body.widgets ?? [],
    },
  })

  return NextResponse.json(preset, { status: 201 })
}
