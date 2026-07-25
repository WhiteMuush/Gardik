import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import type { SavedDashboardConfig } from "@/types/dashboard"
import { getUserPermissions, authorize } from "@/lib/rbac/authorize"

async function getPresetAndCheck(id: string, userId: string, canManageShared: boolean, companyId: string) {
  const preset = await prisma.dashboardPreset.findUnique({ where: { id } })
  if (!preset) return { preset: null, error: "Not found", status: 404 }
  if (preset.companyId !== companyId) return { preset: null, error: "Forbidden", status: 403 }
  if (preset.scope === "PERSONAL" && preset.userId !== userId) return { preset: null, error: "Forbidden", status: 403 }
  if (preset.scope === "COMPANY" && !canManageShared) return { preset: null, error: "Only admins can modify company presets", status: 403 }
  return { preset, error: null, status: 200 }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 })

  const { id } = await params
  const perms = await getUserPermissions(prisma, session.user.roleId ?? null)
  const canManageShared = authorize(perms, "dashboard:manage_shared")
  const { preset, error, status } = await getPresetAndCheck(id, session.user.id, canManageShared, session.user.companyId)
  if (error) return NextResponse.json({ error }, { status })

  const body: { name?: string; layout?: SavedDashboardConfig["layout"]; widgets?: SavedDashboardConfig["widgets"] } = await req.json()

  const updated = await prisma.dashboardPreset.update({
    where: { id: preset!.id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.layout !== undefined && { layout: body.layout }),
      ...(body.widgets !== undefined && { widgets: body.widgets }),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 })

  const { id } = await params
  const perms = await getUserPermissions(prisma, session.user.roleId ?? null)
  const canManageShared = authorize(perms, "dashboard:manage_shared")
  const { preset, error, status } = await getPresetAndCheck(id, session.user.id, canManageShared, session.user.companyId)
  if (error) return NextResponse.json({ error }, { status })

  await prisma.$transaction([
    prisma.user.updateMany({
      where: { activePresetId: preset!.id },
      data: { activePresetId: null },
    }),
    prisma.dashboardPreset.delete({ where: { id: preset!.id } }),
  ])

  return NextResponse.json({ ok: true })
}
