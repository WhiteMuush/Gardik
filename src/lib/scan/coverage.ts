import { prisma } from "@/lib/prisma"
import { providerMeta } from "@/lib/credentials/providers"
import type { ApiProvider, ScanCheck, ScanCheckStatus } from "@prisma/client"

export type SourceCoverage = {
  provider: ApiProvider
  label: string
  checked: number
  failed: number
  neverChecked: number
  lastFailureReason: string | null
  lastFailureAt: Date | null
}

type LastFailure = { reason: string; at: Date }

type StatusCount = { provider: ApiProvider; status: ScanCheckStatus; count: number }

// Coverage of the configured sources only: checks left by a removed source say
// nothing about what the next scan will cover.
export function summarizeCoverage(
  totalEmployees: number,
  activeProviders: ApiProvider[],
  counts: StatusCount[],
  lastFailures: Partial<Record<ApiProvider, LastFailure>>
): SourceCoverage[] {
  return activeProviders.map((provider) => {
    const count = (status: ScanCheckStatus) =>
      counts.find((c) => c.provider === provider && c.status === status)?.count ?? 0
    const checked = count("CHECKED")
    const failed = count("FAILED")
    return {
      provider,
      label: providerMeta(provider)?.label ?? provider,
      checked,
      failed,
      neverChecked: Math.max(0, totalEmployees - checked - failed),
      lastFailureReason: lastFailures[provider]?.reason ?? null,
      lastFailureAt: lastFailures[provider]?.at ?? null,
    }
  })
}

export async function getScanCoverage(companyId: string): Promise<SourceCoverage[]> {
  const [totalEmployees, credentials] = await Promise.all([
    prisma.employee.count({ where: { companyId } }),
    prisma.apiCredential.findMany({
      where: { companyId },
      select: { provider: true },
      orderBy: { provider: "asc" },
    }),
  ])
  const providers = credentials.map((c) => c.provider)
  if (!providers.length) return []

  const where = { employee: { companyId }, provider: { in: providers } }
  const [grouped, failures] = await Promise.all([
    prisma.scanCheck.groupBy({ by: ["provider", "status"], where, _count: { _all: true } }),
    prisma.scanCheck.findMany({
      where: { ...where, status: "FAILED" },
      distinct: ["provider"],
      orderBy: { lastAttemptAt: "desc" },
      select: { provider: true, failureReason: true, lastAttemptAt: true },
    }),
  ])
  const lastFailures: Partial<Record<ApiProvider, LastFailure>> = {}
  for (const f of failures) {
    if (f.failureReason) lastFailures[f.provider] = { reason: f.failureReason, at: f.lastAttemptAt }
  }

  return summarizeCoverage(
    totalEmployees,
    providers,
    grouped.map((g) => ({ provider: g.provider, status: g.status, count: g._count._all })),
    lastFailures
  )
}

export type CheckView = Pick<ScanCheck, "status" | "failureReason" | "lastAttemptAt" | "lastCheckedAt">

function day(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function checkLabel(check: CheckView | null): string {
  if (!check) return "Never checked"
  if (check.status === "CHECKED") return `Checked on ${day(check.lastCheckedAt ?? check.lastAttemptAt)}`
  const last = check.lastCheckedAt ? `Last checked on ${day(check.lastCheckedAt)}` : "Never checked"
  return `Failed on ${day(check.lastAttemptAt)}: ${check.failureReason ?? "Unknown error"}. ${last}`
}

// Identifies the current scan status, so a dismissed banner comes back as soon
// as a scan changes what is missing or why.
export function coverageSignature(coverage: SourceCoverage[]): string {
  return coverage
    .filter((c) => c.failed > 0 || c.neverChecked > 0)
    .map((c) => `${c.provider}:${c.failed}:${c.neverChecked}:${c.lastFailureReason ?? ""}`)
    .join("|")
}
