import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { syncDirectoryConnection } from "@/lib/directory/sync"

const runningSync = new Set<string>()

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Admin only" }, { status: 403 })

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
