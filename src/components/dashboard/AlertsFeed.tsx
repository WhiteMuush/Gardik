"use client"

import { useState } from "react"
import { useWidgetTitle } from "@/hooks/useWidgetTitle"
import { useDetailDrawer, type DetailVariant } from "@/contexts/DetailDrawerContext"
import { cn } from "@/lib/utils"

type Alert = {
  id: string
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED"
  createdAt: string
  employeeName: string | null
  department: string | null
  breachName: string | null
}

const SEVERITY_BORDER: Record<string, string> = {
  CRITICAL: "border-l-severity-critical",
  HIGH:     "border-l-severity-high",
  MEDIUM:   "border-l-severity-medium",
  LOW:      "border-l-severity-low",
}

const SEVERITY_DOT: Record<string, string> = {
  CRITICAL: "bg-severity-critical",
  HIGH:     "bg-severity-high",
  MEDIUM:   "bg-severity-medium",
  LOW:      "bg-severity-low",
}

const STATUS_STYLES: Record<string, string> = {
  OPEN:         "bg-severity-critical/10 text-severity-critical",
  ACKNOWLEDGED: "bg-severity-medium/10 text-severity-medium",
  RESOLVED:     "bg-severity-ok/10 text-severity-ok",
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open", ACKNOWLEDGED: "Ack.", RESOLVED: "Resolved",
}

export function AlertsFeed({ data }: { data: Alert[] }) {
  const { title } = useWidgetTitle("alerts-feed", "Recent Alerts")
  const { openRef } = useDetailDrawer()
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "RESOLVED">("ALL")

  const filtered = data.filter((a) => filter === "ALL" || a.status === filter)

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-3 shrink-0 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
        </div>
      </div>

      <div className="mb-3 shrink-0 flex gap-1.5">
        {(["ALL", "OPEN", "RESOLVED"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {f === "ALL" ? "All" : f === "OPEN" ? "Open" : "Resolved"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">No alerts</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
          {filtered.map((alert) => (
            <button
              key={alert.id}
              type="button"
              onClick={() =>
                openRef({
                  kind: "alert",
                  id: alert.id,
                  title: alert.employeeName ?? "Unknown employee",
                  subtitle: alert.breachName ?? undefined,
                  variant: alert.severity.toLowerCase() as DetailVariant,
                })
              }
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border border-border border-l-2 bg-background px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted",
                SEVERITY_BORDER[alert.severity]
              )}
            >
              <div className={cn("size-1.5 shrink-0 rounded-full", SEVERITY_DOT[alert.severity])} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {alert.employeeName ?? "-"}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {alert.breachName ?? alert.severity}
                  {alert.department && <span className="text-muted-foreground/60"> - {alert.department}</span>}
                </p>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_STYLES[alert.status])}>
                  {STATUS_LABELS[alert.status]}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {new Date(alert.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
