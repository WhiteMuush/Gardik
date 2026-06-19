import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { syncDirectoryConnection } from "@/lib/directory/sync"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin()
  if (error) return error

  const { id } = await params

  // Shared Postgres advisory lock: survives multi-replica, unlike an
  // in-memory Set. xact_lock auto-releases on commit/rollback, so no stale
  // lock is left behind if the process crashes during the sync.
  try {
    const result = await prisma.$transaction(async (tx) => {
      const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(hashtextextended(${id}, 0)) AS locked
      `
      if (!locked) return { conflict: true as const }
      const synced = await syncDirectoryConnection(id, session.user.companyId)
      return { conflict: false as const, synced }
    })

    if (result.conflict)
      return NextResponse.json({ error: "Sync already running" }, { status: 409 })
    return NextResponse.json(result.synced)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
