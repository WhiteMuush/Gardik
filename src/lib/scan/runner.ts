import { prisma } from "@/lib/prisma"
import { decryptConfig } from "@/lib/directory/crypto"
import { loadActiveWebhooks } from "@/lib/webhooks"
import { confidenceForProvider } from "@/lib/credentials/providers"
import { providerById } from "./registry"
import { canonicalBreachKey } from "./normalize"
import { createPacer } from "./pacer"
import { severityFor } from "./severity"
import { handleFinding, notifyRecipients, type Corroboration, type Notify } from "./findings"
import { lookupWithRetry, recordCheck, type LookupOutcome, type PacedProvider } from "./lookup"
import type { BreachProvider } from "./types"
import type { ApiProvider } from "@prisma/client"

export type ActiveProvider = { provider: BreachProvider; key: string; ratePerMinute: number }
export type ScanResult = { scanned: number; newRecords: number; newAlerts: number; failedChecks: number }
export type ScanOptions = { onlyIncomplete?: boolean }

// Loads the providers with a key for the company, decrypts it server-side and marks them as recently used.
export async function loadActiveProviders(companyId: string): Promise<ActiveProvider[]> {
  const creds = await prisma.apiCredential.findMany({ where: { companyId } })
  const active: ActiveProvider[] = []
  for (const cred of creds) {
    const provider = providerById(cred.provider)
    if (!provider) continue
    const { key } = decryptConfig<{ key: string }>(cred.encryptedKey)
    active.push({ provider, key, ratePerMinute: cred.rateLimitPerMinute ?? provider.defaultRatePerMinute })
  }
  if (active.length) {
    await prisma.apiCredential.updateMany({
      where: { companyId, provider: { in: active.map((a) => a.provider.id) } },
      data: { lastUsedAt: new Date() },
    })
  }
  return active
}

// Every employee and provider pair ends as a CHECKED or FAILED ScanCheck, so a skipped lookup never reads as clean.
export async function runScan(
  companyId: string,
  providers: ActiveProvider[],
  options: ScanOptions = {}
): Promise<ScanResult> {
  const employees = await prisma.employee.findMany({
    where: { companyId },
    include: {
      breachRecords: {
        select: {
          id: true,
          breachId: true,
          exposedData: true,
          artifacts: true,
          sources: true,
          breach: { select: { name: true, source: true } },
        },
      },
      alerts: { select: { id: true, breachId: true, severity: true, confidence: true } },
      scanChecks: { select: { provider: true, status: true } },
    },
  })
  const notify: Notify = {
    recipients: await notifyRecipients(companyId),
    webhooks: await loadActiveWebhooks(companyId),
  }

  const paced: PacedProvider[] = providers.map((p) => ({ ...p, pace: createPacer(p.ratePerMinute) }))
  const blocked = new Map<ApiProvider, string>()
  let newRecords = 0
  let failedChecks = 0
  let scanned = 0
  for (const employee of employees) {
    const checked = new Set(employee.scanChecks.filter((c) => c.status === "CHECKED").map((c) => c.provider))
    const due = options.onlyIncomplete ? paced.filter((p) => !checked.has(p.provider.id)) : paced
    if (!due.length) continue
    scanned++

    // Seeded from earlier records, so a breach first seen in a previous scan still dedups.
    const alertByBreach = new Map(
      employee.alerts.flatMap((a) => (a.breachId ? [[a.breachId, a] as const] : []))
    )
    const byCanonical = new Map<string, Corroboration>()
    for (const r of employee.breachRecords) {
      const ckey = canonicalBreachKey(r.breach.name)
      if (byCanonical.has(ckey)) continue
      const al = alertByBreach.get(r.breachId)
      byCanonical.set(ckey, {
        breachId: r.breachId,
        recordId: r.id,
        alertId: al?.id ?? null,
        exposedData: r.exposedData,
        artifacts: r.artifacts,
        sources: r.sources,
        source: r.breach.source,
        severity: al?.severity ?? severityFor(r.exposedData, r.artifacts, r.breach.source),
        confidence: al?.confidence ?? confidenceForProvider(r.sources[0] ?? "HIBP"),
      })
    }

    for (const active of due) {
      const { provider } = active
      const blockedReason = blocked.get(provider.id)
      const outcome: LookupOutcome =
        blockedReason !== undefined
          ? { ok: false, reason: blockedReason, block: false }
          : await lookupWithRetry(active, employee.email)
      if (!outcome.ok) {
        if (outcome.block) blocked.set(provider.id, outcome.reason)
        failedChecks++
        await recordCheck(employee.id, provider.id, outcome.reason)
        continue
      }
      for (const finding of outcome.findings) {
        if (
          await handleFinding(companyId, employee, finding, provider.source, provider.id, byCanonical, notify)
        ) {
          newRecords++
        }
      }
      await recordCheck(employee.id, provider.id, null)
    }
  }

  return { scanned, newRecords, newAlerts: newRecords, failedChecks }
}
