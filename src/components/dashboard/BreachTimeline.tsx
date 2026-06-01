"use client"

import { useState } from "react"
import { useWidgetConfig } from "@/hooks/useWidgetConfig"
import { useWidgetTitle } from "@/hooks/useWidgetTitle"
import { cn } from "@/lib/utils"

type BreachSource = {
  id: string; name: string; source: string
  breachDate: string; dataTypes: string[]; affectedEmployees: number
}

type SourceFilter = "ALL" | "HIBP" | "MANUAL" | "DARK_WEB"

const SOURCE_STYLE: Record<string, { label: string; color: string; dot: string }> = {
  HIBP:     { label: "HIBP",     color: "text-primary",     dot: "bg-primary" },
  MANUAL:   { label: "Manual",   color: "text-purple-400",  dot: "bg-purple-400" },
  DARK_WEB: { label: "Dark Web", color: "text-red-400",     dot: "bg-red-400" },
}

export function BreachTimeline({ data }: { data: BreachSource[] }) {
  const { title } = useWidgetTitle("breach-timeline", "Breach Timeline")
  const [config, setConfig] = useWidgetConfig<{ filter: SourceFilter }>("breach-timeline", { filter: "ALL" })

  const sorted = [...data].sort((a, b) => new Date(b.breachDate).getTime() - new Date(a.breachDate).getTime())
  const filtered = config.filter === "ALL" ? sorted : sorted.filter((b) => b.source === config.filter)

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5">
      <div className="mb-3 shrink-0">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{filtered.length} breaches</p>
      </div>

      {/* Source filter */}
      <div className="mb-3 shrink-0 flex flex-wrap gap-1.5">
        {(["ALL", "HIBP", "MANUAL", "DARK_WEB"] as SourceFilter[]).map((f) => (
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
            {f === "DARK_WEB" ? "Dark Web" : f === "ALL" ? "All" : f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">No breaches found</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="relative pl-5">
            {/* Vertical line */}
            <div className="absolute left-[7px] top-0 bottom-0 w-px bg-border" />

            {filtered.map((breach, i) => {
              const style = SOURCE_STYLE[breach.source] ?? { label: breach.source, color: "text-muted-foreground", dot: "bg-muted" }
              return (
                <div key={breach.id} className={cn("relative pb-4", i === filtered.length - 1 && "pb-0")}>
                  {/* Dot */}
                  <div className={cn("absolute -left-[18px] top-1 size-2.5 rounded-full ring-2 ring-card", style.dot)} />

                  <div className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-foreground leading-snug">{breach.name}</p>
                      <span className={cn("shrink-0 text-[10px] font-semibold uppercase", style.color)}>
                        {style.label}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{new Date(breach.breachDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      <span>{breach.affectedEmployees} affected</span>
                    </div>
                    {breach.dataTypes.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {breach.dataTypes.slice(0, 3).map((t) => (
                          <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {t.replace(/_/g, " ")}
                          </span>
                        ))}
                        {breach.dataTypes.length > 3 && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            +{breach.dataTypes.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
