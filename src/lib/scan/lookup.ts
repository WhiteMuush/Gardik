import { prisma } from "@/lib/prisma"
import { sleep } from "./normalize"
import type { Pace } from "./pacer"
import { ProviderError, failureReason, isRetryable } from "./errors"
import type { Finding } from "./types"
import type { ApiProvider } from "@prisma/client"
import type { ActiveProvider } from "./runner"

const MAX_ATTEMPTS = 4
const BACKOFF_MS = 2000
// The longest wait a scan accepts; a source asking for more (a daily quota) is blocked for the rest of the scan.
const MAX_WAIT_MS = 60_000

export type PacedProvider = ActiveProvider & { pace: Pace }
export type LookupOutcome = { ok: true; findings: Finding[] } | { ok: false; reason: string; block: boolean }

// Retries what waiting can fix; a rejected key, a too-long wait or spent retries block the source for the scan.
export async function lookupWithRetry(active: PacedProvider, email: string): Promise<LookupOutcome> {
  for (let attempt = 1; ; attempt++) {
    await active.pace()
    try {
      return { ok: true, findings: await active.provider.lookup(email, active.key) }
    } catch (err) {
      const reason = failureReason(err)
      if (!isRetryable(err)) {
        const keyRejected = err instanceof ProviderError && (err.status === 401 || err.status === 403)
        return { ok: false, reason, block: keyRejected }
      }
      const wait =
        err instanceof ProviderError && err.retryAfterMs !== null
          ? err.retryAfterMs
          : BACKOFF_MS * 2 ** (attempt - 1)
      if (attempt === MAX_ATTEMPTS || wait > MAX_WAIT_MS) return { ok: false, reason, block: true }
      await sleep(wait)
    }
  }
}

export async function recordCheck(
  employeeId: string,
  provider: ApiProvider,
  reason: string | null
): Promise<void> {
  const now = new Date()
  const data =
    reason === null
      ? { status: "CHECKED" as const, failureReason: null, lastAttemptAt: now, lastCheckedAt: now }
      : { status: "FAILED" as const, failureReason: reason, lastAttemptAt: now }
  await prisma.scanCheck.upsert({
    where: { employeeId_provider: { employeeId, provider } },
    create: { employeeId, provider, ...data },
    update: data,
  })
}
