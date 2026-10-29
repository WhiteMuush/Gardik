import type { PrismaClient } from "@prisma/client"
import { sanitizePreferences, type Preferences } from "./schema"
import { readViews, type SavedViews } from "./views"

export async function loadPreferences(db: PrismaClient, userId: string): Promise<Preferences> {
  const row = await db.userPreference.findUnique({ where: { userId } })
  return sanitizePreferences(row)
}

export async function loadSavedViews(db: PrismaClient, userId: string): Promise<SavedViews> {
  const row = await db.userPreference.findUnique({ where: { userId }, select: { views: true } })
  return readViews(row?.views ?? null)
}
