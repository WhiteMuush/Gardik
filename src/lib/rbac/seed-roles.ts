import type { PrismaClient } from "@prisma/client"
import { PRESETS } from "./presets"

type Db = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

// Idempotently ensure every preset role exists for a company with the correct
// permissions. Safe to call on company creation and to re-run (upsert by the
// unique (companyId, name)). Used by the migration follow-up and company setup.
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
