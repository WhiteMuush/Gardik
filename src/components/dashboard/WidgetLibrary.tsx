"use client"

import { useState, useTransition, type ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, LayoutGrid, Bell, ShieldAlert, Users, TrendingUp } from "lucide-react"
import type { WidgetDef, WidgetCategory } from "@/lib/widgetRegistry"
import type { DashboardPreset, WidgetMeta } from "@/types/dashboard"
import { WidgetCard } from "./WidgetCard"

const CATEGORIES: { key: WidgetCategory; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "alerts", label: "Alerts", icon: Bell },
  { key: "breaches", label: "Breaches", icon: ShieldAlert },
  { key: "employees", label: "Employees", icon: Users },
  { key: "trends", label: "Trends", icon: TrendingUp },
]

function getMeta(metas: WidgetMeta[], instanceId: string, defaultVisible: boolean): WidgetMeta {
  return (
    metas.find((m) => m.instanceId === instanceId) ?? {
      instanceId,
      title: null,
      visible: defaultVisible,
    }
  )
}

export function WidgetLibrary({
  preset,
  allWidgets,
  widgetPreviews,
  visible,
}: {
  preset: DashboardPreset
  allWidgets: WidgetDef[]
  widgetPreviews: Record<string, ReactNode>
  /**
   * Paths this role may open. Reaching this page needs dashboard:customize,
   * which does not imply dashboard:read, so the way back is not guaranteed.
   */
  visible: string[]
}) {
  const [metas, setMetas] = useState<WidgetMeta[]>(preset.widgets)
  const [isPending, startTransition] = useTransition()
  const [savingId, setSavingId] = useState<string | null>(null)

  const toggleWidget = (type: string, defaultVisible: boolean) => {
    const current = getMeta(metas, type, defaultVisible)
    const next = metas.some((m) => m.instanceId === type)
      ? metas.map((m) => (m.instanceId === type ? { ...m, visible: !m.visible } : m))
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
            {visible.includes("/dashboard") && (
              <>
                <Link
                  href="/dashboard"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="size-3.5" />
                  Back to dashboard
                </Link>
                <span className="text-muted-foreground">-</span>
              </>
            )}
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
                {catWidgets.map((widget) => (
                  <WidgetCard
                    key={widget.type}
                    widget={widget}
                    enabled={getMeta(metas, widget.type, widget.defaultVisible ?? true).visible}
                    saving={savingId === widget.type && isPending}
                    preview={widgetPreviews[widget.type]}
                    onToggle={() => toggleWidget(widget.type, widget.defaultVisible ?? true)}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
