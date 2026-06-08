"use client"

import { useWidgetTitle } from "@/hooks/useWidgetTitle"
import { cn } from "@/lib/utils"
import { ShieldAlert, Globe, Eye } from "lucide-react"

type BreachSource = {
  id: string
  name: string
  source: string
  breachDate: string
  dataTypes: string[]
  affectedEmployees: number
}

const SOURCE_LABELS: Record<string, string> = {
  HIBP: "Have I Been Pwned",
  MANUAL: "Manuel",
  DARK_WEB: "Dark Web",
}

const SOURCE_COLORS: Record<string, string> = {
  HIBP: "text-severity-medium bg-severity-medium/10",
  MANUAL: "text-muted-foreground bg-muted",
  DARK_WEB: "text-severity-critical bg-severity-critical/10",
}

export function BreachSourcesList({ data }: { data: BreachSource[] }) {
  const { title } = useWidgetTitle("breach-sources", "Breach Sources")

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5">
      <div className="mb-4 shrink-0 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">Sites that exposed your company data</p>
        </div>
        <ShieldAlert className="size-4 text-muted-foreground shrink-0" />
      </div>

      {data.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">No breaches detected</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
          {data.map((breach) => (
            <div
              key={breach.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background p-3"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Globe className="size-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{breach.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(breach.breachDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {breach.dataTypes.slice(0, 4).map((t) => (
                      <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground capitalize">
                        {t.replace(/_/g, " ")}
                      </span>
                    ))}
                    {breach.dataTypes.length > 4 && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        +{breach.dataTypes.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-right space-y-1.5">
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", SOURCE_COLORS[breach.source] ?? "text-muted-foreground bg-muted")}>
                  {SOURCE_LABELS[breach.source] ?? breach.source}
                </span>
                <div className="flex items-center justify-end gap-1 text-xs text-severity-critical">
                  <Eye className="size-3" />
                  <span className="font-medium tabular-nums">{breach.affectedEmployees}</span>
                  <span className="text-muted-foreground">emp.</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
