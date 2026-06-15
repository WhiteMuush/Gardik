import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/apiAuth"
import { syncDirectoryConnection } from "@/lib/directory/sync"

const runningSync = new Set<string>()

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin()
  if (error) return error

  const { id } = await params

  if (runningSync.has(id))
    return NextResponse.json({ error: "Sync already running" }, { status: 409 })

  runningSync.add(id)
  try {
    const result = await syncDirectoryConnection(id, session.user.companyId)
    return NextResponse.json(result)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  } finally {
    runningSync.delete(id)
  }
}
