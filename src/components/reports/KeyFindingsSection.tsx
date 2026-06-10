import { cn } from "@/lib/utils"
import { ReportSection } from "./ReportSection"
import type { Finding, FindingSeverity } from "@/lib/reports/types"

const DOT: Record<FindingSeverity, string> = {
  critical: "bg-severity-critical",
  high: "bg-severity-high",
  medium: "bg-severity-medium",
  info: "bg-severity-low",
  ok: "bg-severity-ok",
}

export function KeyFindingsSection({ findings }: { findings: Finding[] }) {
  return (
    <ReportSection
      title="Key findings"
      description="Automated assessment of the current security posture"
    >
      {findings.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing notable to report.</p>
      ) : (
        <ul className="space-y-2.5">
          {findings.map((f) => (
            <li key={f.message} className="flex items-start gap-2.5">
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", DOT[f.severity])} />
              <span className="text-sm text-foreground">{f.message}</span>
            </li>
          ))}
        </ul>
      )}
    </ReportSection>
  )
}
