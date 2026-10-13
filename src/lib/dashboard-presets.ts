import { prisma } from "@/lib/prisma"
import type { DashboardPreset } from "@/types/dashboard"

// The user's personal presets and the company ones, creating a personal "Default" on first visit.
export async function loadDashboardPresets(userId: string, companyId: string) {
  const [presets, user] = await Promise.all([
    prisma.dashboardPreset.findMany({
      where: {
        OR: [
          { userId, scope: "PERSONAL" },
          { companyId, scope: "COMPANY" },
        ],
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { activePresetId: true } }),
  ])
  let activePresetId = user?.activePresetId ?? null

  if (presets.length === 0) {
    const created = await prisma.dashboardPreset.create({
      data: { name: "Default", scope: "PERSONAL", userId, companyId, layout: [], widgets: [] },
    })
    presets.push(created)
    activePresetId = created.id
    await prisma.user.update({ where: { id: userId }, data: { activePresetId: created.id } })
  }

  const typedPresets: DashboardPreset[] = presets.map((p) => ({
    id: p.id,
    name: p.name,
    scope: p.scope as DashboardPreset["scope"],
    layout: p.layout as DashboardPreset["layout"],
    widgets: p.widgets as DashboardPreset["widgets"],
    userId: p.userId,
    companyId: p.companyId,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }))
  return { typedPresets, activePresetId }
}
