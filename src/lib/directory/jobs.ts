import { prisma } from "@/lib/prisma"
import { syncDirectoryConnection } from "./sync"
import type { SyncJobStatus } from "@prisma/client"

const BASE_BACKOFF_MS = 30_000

// Exponential backoff between retries: 30s, 60s, 120s, ...
export function backoffMs(attempts: number): number {
  return BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1)
}

// Enqueue a sync for a connection, unless one is already pending or running.
// The find-then-create has a small race window; a duplicate at worst causes a
// redundant re-sync, which is harmless (upserts are idempotent).
export async function enqueueSyncJob(
  connectionId: string
): Promise<{ id: string; status: SyncJobStatus }> {
  const existing = await prisma.syncJob.findFirst({
    where: { connectionId, status: { in: ["PENDING", "RUNNING"] } },
    select: { id: true, status: true },
  })
  if (existing) return existing
  return prisma.syncJob.create({
    data: { connectionId },
    select: { id: true, status: true },
  })
}

type ClaimedJob = {
  id: string
  connectionId: string
  attempts: number
  maxAttempts: number
}

// Atomically claim the next due job and mark it RUNNING. FOR UPDATE SKIP LOCKED
// lets multiple instances drain the queue without processing the same job twice.
async function claimNextJob(): Promise<ClaimedJob | null> {
  const rows = await prisma.$queryRaw<ClaimedJob[]>`
    UPDATE "SyncJob"
    SET status = 'RUNNING', "startedAt" = now(), "updatedAt" = now()
    WHERE id = (
      SELECT id FROM "SyncJob"
      WHERE status = 'PENDING' AND "runAfter" <= now()
      ORDER BY "runAfter" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, "connectionId", attempts, "maxAttempts"
  `
  return rows[0] ?? null
}

async function runJob(job: ClaimedJob): Promise<void> {
  const attempts = job.attempts + 1
  try {
    const conn = await prisma.directoryConnection.findUnique({
      where: { id: job.connectionId },
      select: { companyId: true },
    })
    if (!conn) throw new Error("Connection not found")

    await syncDirectoryConnection(job.connectionId, conn.companyId)
    await prisma.syncJob.update({
      where: { id: job.id },
      data: { status: "SUCCEEDED", attempts, lastError: null, finishedAt: new Date() },
    })
  } catch (e: unknown) {
    const message = (e as Error)?.message ?? "Unknown error"
    const exhausted = attempts >= job.maxAttempts
    await prisma.syncJob.update({
      where: { id: job.id },
      data: exhausted
        ? { status: "FAILED", attempts, lastError: message, finishedAt: new Date() }
        : {
            status: "PENDING",
            attempts,
            lastError: message,
            runAfter: new Date(Date.now() + backoffMs(attempts)),
          },
    })
  }
}

// Drain up to `limit` due jobs. Returns how many were processed (run to a
// terminal or re-queued state). Safe to call from a request, a scheduler, or
// concurrently across instances.
export async function processSyncJobs(limit = 10): Promise<{ processed: number }> {
  let processed = 0
  for (let i = 0; i < limit; i++) {
    const job = await claimNextJob()
    if (!job) break
    await runJob(job)
    processed++
  }
  return { processed }
}
