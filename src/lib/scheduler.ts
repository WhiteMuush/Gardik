import { prisma } from "@/lib/prisma"
import { enqueueSyncJob, processSyncJobs } from "./directory/jobs"
import { loadActiveProviders, runScan } from "./scan/runner"

// A task is due when it has never run, or the interval has elapsed since.
export function isDue(last: Date | null, intervalMinutes: number, now: Date): boolean {
  if (!last) return true
  return now.getTime() - last.getTime() >= intervalMinutes * 60_000
}

export type SchedulerResult = {
  syncsEnqueued: number
  scansStarted: number
  jobsProcessed: number
}

// Enqueue due directory syncs and start due company scans, then drain the sync
// queue. Idempotent per tick: nothing runs before its interval elapses.
// Designed to be called by an external cron hitting /api/cron.
export async function runDueSchedules(now: Date = new Date()): Promise<SchedulerResult> {
  // Directory syncs. SCIM is push-based (the IdP drives it), so it is excluded.
  const connections = await prisma.directoryConnection.findMany({
    where: { autoSyncIntervalMinutes: { not: null }, type: { not: "SCIM" } },
    select: { id: true, lastSyncAt: true, autoSyncIntervalMinutes: true },
  })
  let syncsEnqueued = 0
  for (const c of connections) {
    if (isDue(c.lastSyncAt, c.autoSyncIntervalMinutes!, now)) {
      await enqueueSyncJob(c.id)
      syncsEnqueued++
    }
  }

  // Company exposure scans. Stamp lastScanAt up front so a slow scan is not
  // re-triggered on the next tick; the scan itself runs detached.
  const companies = await prisma.company.findMany({
    where: { scanIntervalMinutes: { not: null } },
    select: { id: true, lastScanAt: true, scanIntervalMinutes: true },
  })
  let scansStarted = 0
  for (const co of companies) {
    if (!isDue(co.lastScanAt, co.scanIntervalMinutes!, now)) continue
    const providers = await loadActiveProviders(co.id)
    if (!providers.length) continue
    await prisma.company.update({ where: { id: co.id }, data: { lastScanAt: now } })
    void runScan(co.id, providers).catch(() => {})
    scansStarted++
  }

  const { processed } = await processSyncJobs()
  return { syncsEnqueued, scansStarted, jobsProcessed: processed }
}
