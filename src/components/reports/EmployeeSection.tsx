import { RiskBadge } from "@/components/ui/RiskBadge"
import { ReportSection } from "./ReportSection"
import type { EmployeeReportRow } from "@/lib/reports/types"

function formatDate(iso: string | null): string {
  if (!iso) return "Never"
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function EmployeeSection({ rows }: { rows: EmployeeReportRow[] }) {
  return (
    <ReportSection
      title="Employee breakdown"
      description="Per-employee exposure and risk level"
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No employees to report.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Employee</th>
                <th className="px-3 py-2 font-medium">Department</th>
                <th className="px-3 py-2 text-right font-medium">Breaches</th>
                <th className="px-3 py-2 font-medium">Last detected</th>
                <th className="px-3 py-2 font-medium">Risk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.email} className="border-t border-border">
                  <td className="px-3 py-2">
                    <span className="text-foreground">{e.name}</span>
                    <span className="block text-xs text-muted-foreground">{e.email}</span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{e.department ?? "Unknown"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground">
                    {e.breachCount}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
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
      )}
    </ReportSection>
  )
}
