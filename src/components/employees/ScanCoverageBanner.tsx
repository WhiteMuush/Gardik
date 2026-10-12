import Link from "next/link"
import { AlertTriangle, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SourceCoverage } from "@/lib/scan/coverage"
import { remedyFor, type RemedyStep } from "@/lib/scan/remedies"
import { ScanButton } from "@/components/employees/ScanButton"

type Props = {
  coverage: SourceCoverage[]
  canScan: boolean
  className?: string
}

function StepLink({ step }: { step: RemedyStep }) {
  if (!step.href) return null
  const className = "ml-1 inline-flex items-center gap-1 text-primary hover:underline"
  if (step.href.startsWith("/")) {
    return (
      <Link href={step.href} className={className}>
        {step.linkLabel}
      </Link>
    )
  }
  return (
    <a href={step.href} target="_blank" rel="noopener noreferrer" className={className}>
      {step.linkLabel} <ExternalLink className="size-3" />
    </a>
  )
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
                <div className="mt-2 space-y-2 rounded-lg border border-border/60 bg-background/60 p-3">
                  <p className="font-medium text-foreground">{remedy.title}</p>
                  <p>{remedy.explanation}</p>
                  <p className="font-medium text-foreground">How to fix it</p>
                  <ol className="list-decimal space-y-1 pl-4">
                    {remedy.steps.map((step) => (
                      <li key={step.text}>
                        {step.text}
                        <StepLink step={step} />
                      </li>
                    ))}
                  </ol>
                </div>
              </details>
            </div>
          )
        })}
      </div>
      {canScan && <ScanButton onlyIncomplete label="Scan unchecked" />}
    </div>
  )
}
