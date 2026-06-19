import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { enqueueSyncJob, processSyncJobs } from "@/lib/directory/jobs"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin()
  if (error) return error

  const { id } = await params

  // Scope the connection to the caller's company before enqueueing.
  const connection = await prisma.directoryConnection.findFirst({
    where: { id, companyId: session.user.companyId },
    select: { id: true },
  })
  if (!connection)
    return NextResponse.json({ error: "Connection not found" }, { status: 404 })

  const job = await enqueueSyncJob(id)

  // Kick the queue without blocking the response. The sync runs outside the
  // request cycle (no timeout risk on large directories); a scheduler also
  // drains the queue, so a dropped fire-and-forget here is only a delay, not a
  // lost job. Concurrency is handled by the job claim, not this call.
  void processSyncJobs().catch(() => {})

  return NextResponse.json({ jobId: job.id, status: job.status }, { status: 202 })
}
