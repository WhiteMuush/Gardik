"use client"

import { useState } from "react"
import { Settings2, X, Plus, Check } from "lucide-react"
import { useWidgetConfig } from "@/hooks/useWidgetConfig"
import { PRESET_DATA_TYPES } from "@/lib/dataTypes"
import { useDashboardEditing } from "@/contexts/DashboardEditContext"
import { useWidgetTitle } from "@/hooks/useWidgetTitle"
import { cn } from "@/lib/utils"

type DataItem = { type: string; count: number; percentage: number }

interface DataTypeBreakdownProps {
  data: DataItem[]
}

type WidgetConfig = { trackedTypes: string[] }

export function DataTypeBreakdown({ data }: DataTypeBreakdownProps) {
  const editing = useDashboardEditing()
  const [config, setConfig] = useWidgetConfig<WidgetConfig>("data-type-breakdown", { trackedTypes: [] })
  const [showSettings, setShowSettings] = useState(false)
  const [newType, setNewType] = useState("")
  const { title } = useWidgetTitle("data-type-breakdown", "Exposed Data Types")

  const toggle = (key: string) => {
    const already = config.trackedTypes.includes(key)
    setConfig({
      ...config,
      trackedTypes: already
        ? config.trackedTypes.filter((t) => t !== key)
        : [...config.trackedTypes, key],
    })
  }

  const addCustom = () => {
    const trimmed = newType.trim().toLowerCase()
    if (!trimmed || config.trackedTypes.includes(trimmed)) return
    setConfig({ ...config, trackedTypes: [...config.trackedTypes, trimmed] })
    setNewType("")
  }

  const breachMap = new Map(data.map((d) => [d.type, d]))
  const totalCount = data.reduce((sum, d) => sum + d.count, 0)

  const merged = [
    ...config.trackedTypes.map((type) =>
      breachMap.get(type) ?? { type, count: 0, percentage: 0 }
    ),
    ...data.filter((d) => !config.trackedTypes.includes(d.type)),
  ].map((item) => ({
    ...item,
    percentage: totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0,
  }))

  const presetKeys = new Set(PRESET_DATA_TYPES.map((p) => p.key))
  const customTypes = config.trackedTypes.filter((t) => !presetKeys.has(t as never))

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-4 shrink-0 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
        </div>
        {editing && <button
          onClick={() => setShowSettings((s) => !s)}
          className={cn(
            "flex size-7 items-center justify-center rounded-md transition-colors",
            showSettings ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {showSettings ? <Check className="size-4" /> : <Settings2 className="size-4" />}
        </button>}
      </div>

      {showSettings && (
        <div className="mb-4 shrink-0 space-y-4 rounded-lg border border-border bg-background p-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tracked types
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_DATA_TYPES.map(({ key, label }) => {
                const active = config.trackedTypes.includes(key)
                return (
                  <button
                    key={key}
                    onClick={() => toggle(key)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Custom type
            </p>
            {customTypes.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {customTypes.map((type) => (
                  <span key={type} className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-foreground">
                    {type.replace(/_/g, " ")}
                    <button onClick={() => toggle(type)} className="text-muted-foreground hover:text-foreground">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustom()}
                placeholder="ex: customer_data, api_keys…"
                className="flex-1 rounded-md border border-input bg-card px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              <button
                onClick={addCustom}
                className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground hover:opacity-90"
              >
                <Plus className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {merged.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">No data exposures detected</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
          {merged.map(({ type, count, percentage }) => (
            <div key={type}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className={cn("text-sm capitalize", count === 0 ? "text-muted-foreground" : "text-foreground")}>
                  {type.replace(/_/g, " ")}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {count > 0 ? `${count} exposure${count > 1 ? "s" : ""} · ${percentage}%` : "not detected"}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", count === 0 ? "bg-border" : "bg-primary")}
                  style={{ width: count === 0 ? "100%" : `${percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
