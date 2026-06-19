import { RiskBadge } from "@/components/ui/RiskBadge"
import { ReportSection } from "./ReportSection"
import type { RiskLevel } from "@/lib/employees"
import type { EmployeeReportRow } from "@/lib/reports/types"

const MAX_ROWS = 50
const RISK_ORDER: Record<RiskLevel, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, OK: 4 }

function formatDate(iso: string | null): string {
  if (!iso) return "Never"
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function EmployeeSection({ rows }: { rows: EmployeeReportRow[] }) {
  const exposed = rows
    .filter((r) => r.breachCount > 0)
    .sort(
      (a, b) =>
        RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel] || b.breachCount - a.breachCount
    )
  const shown = exposed.slice(0, MAX_ROWS)

  return (
    <ReportSection
      title="Exposed employees"
      description="Employees found in breach data, ranked by risk level"
    >
      {exposed.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No exposed employees among the {rows.length} monitored.
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Employee</th>
                  <th className="hidden px-3 py-2 font-medium @[640px]:table-cell">Department</th>
                  <th className="px-3 py-2 text-right font-medium">Breaches</th>
                  <th className="hidden px-3 py-2 font-medium @[520px]:table-cell">Last detected</th>
                  <th className="px-3 py-2 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((e) => (
                  <tr key={e.email} className="border-t border-border">
                    <td className="px-3 py-2">
                      <span className="text-foreground">{e.name}</span>
                      <span className="hidden text-xs text-muted-foreground @[440px]:block">{e.email}</span>
                    </td>
                    <td className="hidden px-3 py-2 text-muted-foreground @[640px]:table-cell">
                      {e.department ?? "Unknown"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">
                      {e.breachCount}
                    </td>
                    <td className="hidden px-3 py-2 text-muted-foreground @[520px]:table-cell">
                      {formatDate(e.lastDetectedAt)}
                    </td>
                    <td className="px-3 py-2">
                      <RiskBadge level={e.riskLevel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {exposed.length > MAX_ROWS && (
            <p className="mt-2 text-xs text-muted-foreground">
              Showing the top {MAX_ROWS} of {exposed.length} exposed employees. The CSV export
              contains the full list, including non-exposed employees.
            </p>
          )}
        </>
      )}
    </ReportSection>
  )
}
