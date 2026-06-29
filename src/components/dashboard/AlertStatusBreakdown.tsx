"use client"

import { useWidgetTitle } from "@/hooks/useWidgetTitle"

type StatusCounts = { open: number; acknowledged: number; resolved: number }

const STATUSES = [
  {
    key: "open" as const,
    label: "Open",
    description: "Unaddressed alerts",
    color: "oklch(var(--severity-critical))",
    track: "oklch(var(--severity-critical) / 0.15)",
  },
  {
    key: "acknowledged" as const,
    label: "Acknowledged",
    description: "Under review",
    color: "oklch(var(--severity-medium))",
    track: "oklch(var(--severity-medium) / 0.15)",
  },
  {
    key: "resolved" as const,
    label: "Resolved",
    description: "Closed alerts",
    color: "oklch(var(--severity-low))",
    track: "oklch(var(--severity-low) / 0.15)",
  },
]

export function AlertStatusBreakdown({ data }: { data: StatusCounts }) {
  const { title } = useWidgetTitle("alert-status-breakdown", "Alert Status")

  const total = data.open + data.acknowledged + data.resolved

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-4 shrink-0">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{total} total alerts</p>
      </div>

      {total === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">No alerts recorded</p>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 flex-col justify-center gap-4">
          {STATUSES.map((s) => {
            const count = data[s.key]
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            return (
              <div key={s.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-foreground">{s.label}</span>
                    <span className="ml-1.5 text-[11px] text-muted-foreground">{s.description}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-foreground">{count}</span>
                    <span className="ml-1 text-[11px] text-muted-foreground">{pct}%</span>
                  </div>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full" style={{ background: s.track }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: s.color }}
                  />
                </div>
              </div>
            )
          })}

          {/* Resolution rate */}
          <div className="mt-1 rounded-lg border border-border bg-background p-3 text-center">
            <p className="text-[11px] text-muted-foreground">Resolution rate</p>
            <p className="text-xl font-bold text-foreground">
              {total > 0 ? Math.round((data.resolved / total) * 100) : 0}%
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
