import { AlertTriangle } from "lucide-react"
import { coverageSignature, type SourceCoverage } from "@/lib/scan/coverage"
import { remedyFor } from "@/lib/scan/remedies"
import { RemedyPanel } from "@/components/employees/RemedyPanel"
import { ScanButton } from "@/components/employees/ScanButton"
import { DismissibleBanner } from "@/components/employees/DismissibleBanner"

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
    <DismissibleBanner signature={coverageSignature(coverage)} className={className}>
      <div className="flex items-start gap-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 py-3 pl-4 pr-10">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium text-foreground">Scan incomplete</p>
          {incomplete.map((c) => {
            const missed = c.failed + c.neverChecked
            const remedy = remedyFor(c.provider, c.failed > 0 ? c.lastFailureReason : null)
            return (
              <div key={c.provider} className="text-xs text-muted-foreground">
                <p>
                  {missed} employee{missed !== 1 ? "s" : ""} not checked by {c.label}
                  {c.failed > 0 && c.lastFailureReason ? ` (last error: ${c.lastFailureReason})` : ""}
                </p>
                <details className="group mt-1">
                  <summary className="cursor-pointer select-none text-primary hover:underline">
                    <span className="group-open:hidden">Learn more</span>
                    <span className="hidden group-open:inline">Hide details</span>
                  </summary>
                  <div className="mt-2">
                    <RemedyPanel remedy={remedy} />
                  </div>
                </details>
              </div>
            )
          })}
        </div>
        {canScan && <ScanButton onlyIncomplete label="Scan unchecked" />}
      </div>
    </DismissibleBanner>
  )
}
