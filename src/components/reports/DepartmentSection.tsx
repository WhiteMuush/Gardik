import { cn } from "@/lib/utils"
import { ReportSection } from "./ReportSection"
import type { DepartmentRow } from "@/lib/reports/types"

export function DepartmentSection({ rows }: { rows: DepartmentRow[] }) {
  return (
    <ReportSection
      title="Exposure by department"
      description="Which parts of the organization carry the most risk"
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No departments to report.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Department</th>
                <th className="px-3 py-2 text-right font-medium">Employees</th>
                <th className="px-3 py-2 text-right font-medium">Exposed</th>
                <th className="px-3 py-2 font-medium">Exposure rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.department} className="border-t border-border">
                  <td className="px-3 py-2 text-foreground">{r.department}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground">{r.total}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground">{r.exposed}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            r.exposureRate >= 50 ? "bg-severity-high" : "bg-primary"
                          )}
                          style={{ width: `${r.exposureRate}%` }}
                        />
                      </div>
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          r.exposureRate >= 50 ? "text-severity-high" : "text-muted-foreground"
                        )}
                      >
                        {r.exposureRate}%
                      </span>
                    </div>
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
