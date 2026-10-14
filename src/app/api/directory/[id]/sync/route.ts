import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/apiAuth"
import { rateLimit } from "@/lib/rateLimit"
import { prisma } from "@/lib/prisma"
import { enqueueSyncJob, processSyncJobs } from "@/lib/directory/jobs"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requirePermission("connectors:sync")
  if (error) return error

  // A sync walks a whole directory, so queueing them fast would load the database and the remote directory.
  if (!(await rateLimit(`directory-sync:${session.user.companyId}`, 10, 60_000))) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 })
  }

  const { id } = await params

  // Scope the connection to the caller's company before enqueueing.
  const connection = await prisma.directoryConnection.findFirst({
    where: { id, companyId: session.user.companyId },
    select: { id: true },
  })
  if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 })

  const job = await enqueueSyncJob(id)

  // Fire-and-forget is safe, since the scheduler also drains the queue and the job claim handles concurrency.
  void processSyncJobs().catch(() => {})

  return NextResponse.json({ jobId: job.id, status: job.status }, { status: 202 })
}
