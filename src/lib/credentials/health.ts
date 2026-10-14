import type { SourceCoverage } from "@/lib/scan/coverage"

export type HealthStatus = "CONNECTED" | "NEEDS_ACTION" | "NOT_SCANNED" | "NOT_CONNECTED"
export type SourceHealth = { status: HealthStatus; label: string; detail: string | null }

// A key or rate changed after the last failure is not shown as broken, since the fix is untried.
export function sourceHealth(
  credential: { updatedAt: Date } | null,
  coverage: SourceCoverage | null
): SourceHealth {
  if (!credential) return { status: "NOT_CONNECTED", label: "Not connected", detail: null }
  if (coverage && coverage.failed > 0) {
    if (coverage.lastFailureAt && new Date(credential.updatedAt) > new Date(coverage.lastFailureAt)) {
      return {
        status: "NOT_SCANNED",
        label: "Changed since last scan",
        detail: "The key or the rate changed after the last failure. Run a scan to check it.",
      }
    }
    const reason = coverage.lastFailureReason ?? "Last scan failed"
    return { status: "NEEDS_ACTION", label: reason, detail: reason }
  }
  if (!coverage || coverage.checked === 0) {
    return { status: "NOT_SCANNED", label: "Not scanned yet", detail: "Run a scan to check this source." }
  }
  return { status: "CONNECTED", label: "Connected", detail: null }
}
