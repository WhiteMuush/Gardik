import type { PrismaClient } from "@prisma/client"
import { PRESETS } from "./presets"

type Db = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

// Upserts every preset role with its permissions, so it is safe on company creation and on re-runs.
export async function seedPresetsForCompany(db: Db, companyId: string): Promise<void> {
  for (const preset of PRESETS) {
    await db.role.upsert({
      where: { companyId_name: { companyId, name: preset.name } },
      update: {
        description: preset.description,
        permissions: [...preset.permissions],
        isSystem: preset.isSystem,
        isAssignable: preset.isAssignable,
      },
      create: {
        companyId,
        name: preset.name,
        description: preset.description,
        permissions: [...preset.permissions],
        isSystem: preset.isSystem,
        isAssignable: preset.isAssignable,
      },
    })
  }
}

export async function resolvePresetRoleId(db: Db, companyId: string, name: string): Promise<string> {
  const role = await db.role.findUniqueOrThrow({
    where: { companyId_name: { companyId, name } },
  })
  return role.id
}
