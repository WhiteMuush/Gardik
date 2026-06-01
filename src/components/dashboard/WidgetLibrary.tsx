"use client"

import { useState, useTransition, type ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, LayoutGrid, Bell, ShieldAlert, Users, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import type { WidgetDef, WidgetCategory } from "@/lib/widgetRegistry"
import type { DashboardPreset, WidgetMeta } from "@/types/dashboard"

const PREVIEW_SCALE = 0.42
const PREVIEW_H = 200

const CATEGORIES: { key: WidgetCategory; label: string; icon: React.ElementType }[] = [
  { key: "overview",  label: "Overview",  icon: LayoutGrid },
  { key: "alerts",    label: "Alerts",    icon: Bell },
  { key: "breaches",  label: "Breaches",  icon: ShieldAlert },
  { key: "employees", label: "Employees", icon: Users },
  { key: "trends",    label: "Trends",    icon: TrendingUp },
]

function getMeta(metas: WidgetMeta[], instanceId: string, defaultVisible: boolean): WidgetMeta {
  return metas.find((m) => m.instanceId === instanceId) ?? {
    instanceId,
    title: null,
    visible: defaultVisible,
  }
}

function WidgetPreview({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  return (
    <div
      className="relative overflow-hidden rounded-t-xl border-b border-border transition-all duration-300"
      style={{
        height: `${PREVIEW_H}px`,
        filter: enabled ? "none" : "grayscale(1) opacity(0.35)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: `${(1 / PREVIEW_SCALE) * 100}%`,
          height: `${(1 / PREVIEW_SCALE) * 100}%`,
          transform: `scale(${PREVIEW_SCALE})`,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function WidgetLibrary({
  preset,
  allWidgets,
  widgetPreviews,
}: {
  preset: DashboardPreset
  allWidgets: WidgetDef[]
  widgetPreviews: Record<string, ReactNode>
}) {
  const [metas, setMetas] = useState<WidgetMeta[]>(preset.widgets)
  const [isPending, startTransition] = useTransition()
  const [savingId, setSavingId] = useState<string | null>(null)

  const toggleWidget = (type: string, defaultVisible: boolean) => {
    const current = getMeta(metas, type, defaultVisible)
    const next = metas.some((m) => m.instanceId === type)
      ? metas.map((m) => m.instanceId === type ? { ...m, visible: !m.visible } : m)
      : [...metas, { instanceId: type, title: null, visible: !current.visible }]

    setMetas(next)
    setSavingId(type)

    startTransition(async () => {
      await fetch(`/api/dashboard/presets/${preset.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgets: next }),
      })
      setSavingId(null)
    })
  }

  const enabledCount = metas.filter((m) => m.visible).length

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Back to dashboard
            </Link>
            <span className="text-muted-foreground">·</span>
            <h1 className="text-sm font-semibold text-foreground">Widget Library</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {enabledCount} active
            </span>
            <span className="text-xs text-muted-foreground">
              Profile: <span className="font-medium text-foreground">{preset.name}</span>
            </span>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Click a widget to add or remove it from your current profile.
        </p>
      </div>

      {/* Grid by category */}
      <div className="flex-1 space-y-8 px-6 py-6">
        {CATEGORIES.map((cat) => {
          const catWidgets = allWidgets.filter((w) => w.category === cat.key)
          if (catWidgets.length === 0) return null
          const Icon = cat.icon

          const activeInCat = catWidgets.filter(
            (w) => getMeta(metas, w.type, w.defaultVisible ?? true).visible
          ).length

          return (
            <section key={cat.key}>
              <div className="mb-4 flex items-center gap-2">
                <Icon className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">{cat.label}</h2>
                <span className="text-xs text-muted-foreground">
                  {activeInCat}/{catWidgets.length} active
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {catWidgets.map((widget) => {
                  const meta = getMeta(metas, widget.type, widget.defaultVisible ?? true)
                  const isEnabled = meta.visible
                  const isSaving = savingId === widget.type && isPending
                  const preview = widgetPreviews[widget.type]

                  return (
                    <div
                      key={widget.type}
                      className={cn(
                        "group overflow-hidden rounded-xl border transition-all duration-200",
                        isEnabled
                          ? "border-primary/40 shadow-sm hover:border-primary/60"
                          : "border-border hover:border-muted-foreground/40"
                      )}
                    >
                      {/* Preview */}
                      <WidgetPreview enabled={isEnabled}>
                        {preview}
                      </WidgetPreview>

                      {/* Footer */}
                      <div
                        className={cn(
                          "flex items-center justify-between gap-3 p-3 transition-colors",
                          isEnabled ? "bg-primary/5" : "bg-card"
                        )}
                      >
                        <div className="min-w-0">
                          <p className={cn(
                            "truncate text-xs font-semibold",
                            isEnabled ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {widget.defaultTitle}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {widget.defaultSize.w}×{widget.defaultSize.h} cells
                          </p>
                        </div>

                        {/* Toggle */}
                        <button
                          onClick={() => toggleWidget(widget.type, widget.defaultVisible ?? true)}
                          disabled={isSaving}
                          className={cn(
                            "relative flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 transition-all duration-200",
                            isEnabled
                              ? "border-primary bg-primary"
                              : "border-border bg-muted"
                          )}
                          title={isEnabled ? "Remove from dashboard" : "Add to dashboard"}
                        >
                          <span
                            className={cn(
                              "absolute flex size-4 items-center justify-center rounded-full bg-white shadow transition-all duration-200",
                              isEnabled ? "left-[18px]" : "left-[1px]"
                            )}
                          >
                            {isSaving && (
                              <span className="size-2.5 animate-spin rounded-full border border-primary border-t-transparent" />
                            )}
                          </span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
