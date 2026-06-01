"use client"

import { useWidgetConfig } from "@/hooks/useWidgetConfig"
import { useWidgetTitle } from "@/hooks/useWidgetTitle"
import { cn } from "@/lib/utils"

type UrgentAlert = {
  id: string
  severity: string
  createdAt: string
  employeeName: string | null
  department: string | null
  breachName: string | null
}

type Filter = "ALL" | "CRITICAL" | "HIGH"

const SEV_BADGE_CLASSES: Record<string, string> = {
  CRITICAL: "bg-red-500/10 text-red-400 border border-red-500/20",
  HIGH:     "bg-orange-500/10 text-orange-400 border border-orange-500/20",
}

export function CriticalAlertsList({ data }: { data: UrgentAlert[] }) {
  const { title } = useWidgetTitle("critical-alerts", "Urgent Alerts")
  const [config, setConfig] = useWidgetConfig<{ filter: Filter }>("critical-alerts", { filter: "ALL" })

  const filtered = config.filter === "ALL" ? data : data.filter((a) => a.severity === config.filter)

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5">
      <div className="mb-3 shrink-0">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{filtered.length} open — action required</p>
      </div>

      <div className="mb-3 shrink-0 flex gap-1.5">
        {(["ALL", "CRITICAL", "HIGH"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setConfig({ filter: f })}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              config.filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">No urgent alerts</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
          {filtered.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5"
            >
              <span className={cn("mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", SEV_BADGE_CLASSES[alert.severity] ?? "bg-muted text-muted-foreground")}>
                {alert.severity}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">
                  {alert.employeeName ?? "Unknown employee"}
                  {alert.department && (
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      {alert.department}
                    </span>
                  )}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{alert.breachName ?? "—"}</p>
              </div>
              <span className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">
                {new Date(alert.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
