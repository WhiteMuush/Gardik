import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

const MIN_INTERVAL_MINUTES = 5

// Validate an interval field: null disables, otherwise an integer >= the floor.
function parseInterval(value: unknown): number | null | undefined {
  if (value === null) return null
  if (typeof value === "number" && Number.isInteger(value) && value >= MIN_INTERVAL_MINUTES)
    return value
  return undefined // invalid
}

// Set the auto-sync cadence for a connection. SCIM is push-based, so it cannot
// be put on a pull schedule.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const body = (await req.json()) as { autoSyncIntervalMinutes?: unknown }
  const interval = parseInterval(body.autoSyncIntervalMinutes)
  if (interval === undefined)
    return NextResponse.json(
      { error: `autoSyncIntervalMinutes must be null or an integer >= ${MIN_INTERVAL_MINUTES}` },
      { status: 400 }
    )

  const connection = await prisma.directoryConnection.findFirst({
    where: { id, companyId: session.user.companyId },
    select: { type: true },
  })
  if (!connection) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (connection.type === "SCIM" && interval !== null)
    return NextResponse.json(
      { error: "SCIM connections are push-based and cannot be auto-synced" },
      { status: 400 }
    )

  await prisma.directoryConnection.update({
    where: { id },
    data: { autoSyncIntervalMinutes: interval },
  })
  return NextResponse.json({ id, autoSyncIntervalMinutes: interval })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin()
  if (error) return error

  const { id } = await params

  const connection = await prisma.directoryConnection.findFirst({
    where: { id, companyId: session.user.companyId },
  })
  if (!connection) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.directoryConnection.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
