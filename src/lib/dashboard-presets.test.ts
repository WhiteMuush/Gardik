import { describe, it, expect, vi, beforeEach } from "vitest"

const db = vi.hoisted(() => ({
  dashboardPreset: { findMany: vi.fn(), create: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
}))
vi.mock("@/lib/prisma", () => ({ prisma: db }))

import { loadDashboardPresets } from "./dashboard-presets"

const at = new Date("2026-01-01T00:00:00Z")
const row = (id: string, scope: string) => ({
  id,
  name: id,
  scope,
  layout: [],
  widgets: [],
  userId: "u1",
  companyId: "c1",
  createdAt: at,
  updatedAt: at,
})

beforeEach(() => vi.clearAllMocks())

describe("loadDashboardPresets", () => {
  it("returns the personal and company presets with the stored active one", async () => {
    db.dashboardPreset.findMany.mockResolvedValue([row("mine", "PERSONAL"), row("shared", "COMPANY")])
    db.user.findUnique.mockResolvedValue({ activePresetId: "shared" })
    const { typedPresets, activePresetId } = await loadDashboardPresets("u1", "c1")
    expect(typedPresets.map((p) => p.id)).toEqual(["mine", "shared"])
    expect(typedPresets[0]?.createdAt).toBe("2026-01-01T00:00:00.000Z")
    expect(activePresetId).toBe("shared")
    expect(db.dashboardPreset.findMany.mock.calls[0]?.[0].where).toEqual({
      OR: [
        { userId: "u1", scope: "PERSONAL" },
        { companyId: "c1", scope: "COMPANY" },
      ],
    })
    expect(db.dashboardPreset.create).not.toHaveBeenCalled()
  })

  it("creates and activates a personal Default preset on first visit", async () => {
    db.dashboardPreset.findMany.mockResolvedValue([])
    db.user.findUnique.mockResolvedValue({ activePresetId: null })
    db.dashboardPreset.create.mockResolvedValue(row("new", "PERSONAL"))
    const { typedPresets, activePresetId } = await loadDashboardPresets("u1", "c1")
    expect(db.dashboardPreset.create.mock.calls[0]?.[0].data).toMatchObject({
      name: "Default",
      scope: "PERSONAL",
    })
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { activePresetId: "new" } })
    expect(typedPresets.map((p) => p.id)).toEqual(["new"])
    expect(activePresetId).toBe("new")
  })
})
