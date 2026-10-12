import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SourceCoverage } from "@/lib/scan/coverage"
import { ScanButton } from "@/components/employees/ScanButton"

type Props = {
  coverage: SourceCoverage[]
  canScan: boolean
  className?: string
}

// Shown while any configured source has employees it failed or never checked,
// so an empty breach list is never read as "nothing leaked".
export function ScanCoverageBanner({ coverage, canScan, className }: Props) {
  const incomplete = coverage.filter((c) => c.failed > 0 || c.neverChecked > 0)
  if (!incomplete.length) return null

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3",
        className
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium text-foreground">Scan incomplete</p>
        {incomplete.map((c) => (
          <p key={c.provider} className="text-xs text-muted-foreground">
            {c.failed + c.neverChecked} employee{c.failed + c.neverChecked !== 1 ? "s" : ""} not checked by{" "}
            {c.label}
            {c.failed > 0 && c.lastFailureReason ? ` (last error: ${c.lastFailureReason})` : ""}
          </p>
        ))}
      </div>
      {canScan && <ScanButton onlyIncomplete label="Scan unchecked" />}
    </div>
  )
}
