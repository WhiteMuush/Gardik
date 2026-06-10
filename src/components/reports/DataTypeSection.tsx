import { ReportSection } from "./ReportSection"
import type { DataTypeExposure } from "@/lib/reports/types"

export function DataTypeSection({ rows }: { rows: DataTypeExposure[] }) {
  return (
    <ReportSection
      title="Exposed data types"
      description="What kind of data appears in breach records"
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No exposed data recorded.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Data type</th>
                <th className="px-3 py-2 text-right font-medium">Records</th>
                <th className="px-3 py-2 font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.type} className="border-t border-border">
                  <td className="px-3 py-2">
                    <span className="text-foreground">{t.label}</span>
                    {t.critical && (
                      <span className="ml-2 rounded-md bg-severity-high/10 px-1.5 py-0.5 text-xs font-medium text-severity-high">
                        Sensitive
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground">{t.count}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${t.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {t.percentage}%
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
