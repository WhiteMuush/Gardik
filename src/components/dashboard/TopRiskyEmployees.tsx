"use client"

import { useWidgetTitle } from "@/hooks/useWidgetTitle"
import { cn } from "@/lib/utils"
import { ShieldAlert, AlertTriangle } from "lucide-react"

type Employee = {
  id: string
  name: string
  department: string | null
  breachCount: number
  openAlerts: number
  riskScore: number
  riskLevel: string
  riskVariant: "critical" | "high" | "medium" | "ok" | "default"
}

const VARIANT_STYLES: Record<string, string> = {
  critical: "text-severity-critical bg-severity-critical/10",
  high:     "text-severity-high bg-severity-high/10",
  medium:   "text-severity-medium bg-severity-medium/10",
  ok:       "text-severity-ok bg-severity-ok/10",
  default:  "text-muted-foreground bg-muted",
}

const SCORE_BAR: Record<string, string> = {
  critical: "bg-severity-critical",
  high:     "bg-severity-high",
  medium:   "bg-severity-medium",
  ok:       "bg-severity-ok",
  default:  "bg-muted-foreground",
}

export function TopRiskyEmployees({ data }: { data: Employee[] }) {
  const { title } = useWidgetTitle("top-risky-employees", "Top Employees at Risk")

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-4 shrink-0 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
        </div>
        <AlertTriangle className="size-4 text-muted-foreground shrink-0" />
      </div>

      {data.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">No compromised employees</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
          {data.map((emp, i) => (
            <div key={emp.id} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
              <span className="shrink-0 w-5 text-xs font-medium text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-foreground truncate">{emp.name}</p>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", VARIANT_STYLES[emp.riskVariant])}>
                    {emp.riskLevel}
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-1.5">
                  {emp.department && (
                    <span className="text-[11px] text-muted-foreground truncate">{emp.department}</span>
                  )}
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {emp.breachCount} breach{emp.breachCount > 1 ? "es" : ""}
                  </span>
                  {emp.openAlerts > 0 && (
                    <span className="text-[11px] text-severity-critical shrink-0 flex items-center gap-0.5">
                      <ShieldAlert className="size-3" />
                      {emp.openAlerts}
                    </span>
                  )}
                </div>
                <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", SCORE_BAR[emp.riskVariant])}
                    style={{ width: `${emp.riskScore}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
