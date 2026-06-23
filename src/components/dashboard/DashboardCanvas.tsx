"use client"

import { useState, useCallback, useEffect, useRef, type ReactNode } from "react"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ResponsiveGridLayout, verticalCompactor } = require("react-grid-layout")
import "react-grid-layout/css/styles.css"
import "react-resizable/css/styles.css"
import { Settings2, Check, Plus, Building2, User, LayoutGrid, GripHorizontal, Filter } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DashboardEditContext } from "@/contexts/DashboardEditContext"
import { DashboardConfigContext } from "@/contexts/DashboardConfigContext"
import { type GridItemLayout, type WidgetMeta, type DashboardPreset, SOURCE_FILTERABLE_WIDGETS } from "@/types/dashboard"

export type SourceOption = { id: string; label: string }
import { buildDefaultLayout, buildDefaultMeta, mergeLayout, mergeMeta } from "./dashboardLayoutUtils"
import { PresetTab } from "./PresetTab"
import { RenameOverlay } from "./RenameOverlay"

const COLS = 12

export type WidgetEntry = {
  instanceId: string
  type: string
  defaultTitle: string
  content: ReactNode
  defaultSize: { w: number; h: number }
  defaultPosition?: { x: number; y: number }
  minSize: { w: number; h: number }
  centerContent?: boolean
  defaultVisible?: boolean
}

type RglItem = {
  i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number
}

export function DashboardCanvas({
  widgets,
  presets: initialPresets,
  activePresetId: initialActivePresetId,
  userRole,
  sourceOptions = [],
}: {
  widgets: WidgetEntry[]
  presets: DashboardPreset[]
  activePresetId: string | null
  userRole: string
  sourceOptions?: SourceOption[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [containerW, setContainerW] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const [presets, setPresets] = useState<DashboardPreset[]>(initialPresets)
  const [activePresetId, setActivePresetId] = useState<string | null>(initialActivePresetId)

  const activePreset = presets.find((p) => p.id === activePresetId) ?? presets[0] ?? null

  const initLayout = useCallback((preset: DashboardPreset | null) => {
    if (!preset || !preset.layout?.length) return buildDefaultLayout(widgets)
    return mergeLayout(preset.layout, widgets)
  }, [widgets])

  const initMeta = useCallback((preset: DashboardPreset | null) => {
    if (!preset || !preset.widgets?.length) return buildDefaultMeta(widgets)
    return mergeMeta(preset.widgets, widgets)
  }, [widgets])

  const [layout, setLayout] = useState<GridItemLayout[]>(() => initLayout(activePreset))
  const [meta, setMeta] = useState<WidgetMeta[]>(() => initMeta(activePreset))
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!addMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (!addMenuRef.current?.contains(e.target as Node)) setAddMenuOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [addMenuOpen])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => setContainerW(entries[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const persistPreset = useCallback((id: string, nextLayout: GridItemLayout[], nextMeta: WidgetMeta[]) => {
    setPresets((prev) => prev.map((p) => p.id === id ? { ...p, layout: nextLayout, widgets: nextMeta } : p))
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      fetch(`/api/dashboard/presets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: nextLayout, widgets: nextMeta }),
      })
    }, 800)
  }, [])

  const switchPreset = useCallback((preset: DashboardPreset) => {
    setActivePresetId(preset.id)
    setLayout(initLayout(preset))
    setMeta(initMeta(preset))
    fetch(`/api/dashboard/presets/${preset.id}/activate`, { method: "PATCH" })
  }, [initLayout, initMeta])

  const createPreset = useCallback(async (scope: "PERSONAL" | "COMPANY") => {
    const name = scope === "COMPANY" ? "Company View" : `View ${presets.filter((p) => p.scope === "PERSONAL").length + 1}`
    const res = await fetch("/api/dashboard/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, scope, layout: buildDefaultLayout(widgets), widgets: buildDefaultMeta(widgets) }),
    })
    if (!res.ok) return
    const created: DashboardPreset = await res.json()
    setPresets((prev) => [...prev, created])
    switchPreset(created)
  }, [presets, widgets, switchPreset])

  const renamePreset = useCallback(async (id: string, name: string) => {
    await fetch(`/api/dashboard/presets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    setPresets((prev) => prev.map((p) => p.id === id ? { ...p, name } : p))
  }, [])

  const deletePreset = useCallback(async (id: string) => {
    await fetch(`/api/dashboard/presets/${id}`, { method: "DELETE" })
    setPresets((prev) => {
      const next = prev.filter((p) => p.id !== id)
      if (activePresetId === id) {
        const fallback = next[0] ?? null
        setActivePresetId(fallback?.id ?? null)
        setLayout(initLayout(fallback))
        setMeta(initMeta(fallback))
      }
      return next
    })
  }, [activePresetId, initLayout, initMeta])

  const onLayoutChange = (current: RglItem[]) => {
    const next = current.map((item) => ({
      i: item.i, x: item.x, y: item.y, w: item.w, h: item.h, minW: item.minW, minH: item.minH,
    }))
    setLayout(next)

    // HARD RULE: the dashboard is only ever modified in Customize mode.
    // Outside editing we never write — not on mount, not on compaction, never.
    // New widgets still flow into free space visually (y:Infinity + vertical
    // compaction on render); that placement is baked into the DB the next time
    // the user arranges things in Customize.
    if (!editing || !activePreset) return

    // The grid only renders visible widgets, so `next` omits hidden ones.
    // Preserve hidden widgets' saved positions so toggling them off never loses placement.
    const savedLayout = activePreset.layout ?? []
    const visibleIds = new Set(next.map((l) => l.i))
    const preserved = savedLayout.filter((l) => !visibleIds.has(l.i))
    const merged = [...next, ...preserved]
    persistPreset(activePreset.id, merged, meta)
  }

  const setTitle = useCallback((instanceId: string, title: string) => {
    const next = meta.map((m) => m.instanceId === instanceId ? { ...m, title } : m)
    setMeta(next)
    if (activePreset) persistPreset(activePreset.id, layout, next)
  }, [meta, layout, activePreset, persistPreset])

  const getTitle = useCallback((instanceId: string, defaultTitle: string) => {
    const m = meta.find((m) => m.instanceId === instanceId)
    return m?.title ?? defaultTitle
  }, [meta])

  const getSource = useCallback((instanceId: string) => {
    return meta.find((m) => m.instanceId === instanceId)?.source ?? null
  }, [meta])

  // Changing a widget's provider scope must re-run the server (the slice is
  // computed there), so we save immediately and refresh rather than debounce.
  const setSource = useCallback(async (instanceId: string, source: string | null) => {
    const next = meta.map((m) => m.instanceId === instanceId ? { ...m, source } : m)
    setMeta(next)
    if (!activePreset) return
    setPresets((prev) => prev.map((p) => p.id === activePreset.id ? { ...p, widgets: next } : p))
    await fetch(`/api/dashboard/presets/${activePreset.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout, widgets: next }),
    })
    router.refresh()
  }, [meta, layout, activePreset, router])

  const visibleWidgets = widgets.filter((w) => {
    const m = meta.find((m) => m.instanceId === w.instanceId)
    return m?.visible !== false
  })

  // Controlled layout fed to RGL via the `layouts` prop (not per-child data-grid,
  // which RGL only reads on first mount). Widgets with no saved position get
  // y: Infinity so vertical compaction drops them into the first free space.
  // Note: we never set `static` here — drag/resize locking outside Customize is
  // handled by isDraggable/isResizable={editing}. A `static` item is excluded from
  // compaction, which would make newly-added widgets overlap instead of flowing in.
  const rglLayout = visibleWidgets.map((w) => {
    return layout.find((l) => l.i === w.instanceId) ?? {
      i: w.instanceId,
      x: 0,
      y: Infinity,
      w: w.defaultSize.w,
      h: w.defaultSize.h,
      minW: w.minSize.w,
      minH: w.minSize.h,
    }
  })

  const isAdmin = userRole === "ADMIN"
  const canEditPreset = activePreset
    ? activePreset.scope === "PERSONAL" || isAdmin
    : false

  return (
    <DashboardEditContext.Provider value={editing}>
      <DashboardConfigContext.Provider value={{ getTitle, setTitle, editing }}>
        <div className="flex flex-1 flex-col min-h-0">

          {/* ── Toolbar ─────────────────────────────────────────────────── */}
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">

            {/* Preset tabs */}
            <div className="flex flex-1 items-center gap-1.5 overflow-x-auto scrollbar-none">
              {presets.map((p) => (
                <PresetTab
                  key={p.id}
                  preset={p}
                  active={p.id === activePreset?.id}
                  canDelete={presets.length > 1 && (p.scope === "PERSONAL" || isAdmin)}
                  canRename={p.scope === "PERSONAL" || isAdmin}
                  onClick={() => switchPreset(p)}
                  onRename={(name) => renamePreset(p.id, name)}
                  onDelete={() => deletePreset(p.id)}
                />
              ))}
            </div>

            {/* New preset button — outside overflow container to avoid clipping */}
            <div ref={addMenuRef} className="relative shrink-0">
              <button
                onClick={() => isAdmin ? setAddMenuOpen((o) => !o) : createPreset("PERSONAL")}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Add preset"
              >
                <Plus className="size-3.5" />
              </button>
              {addMenuOpen && isAdmin && (
                <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-md border border-border bg-popover shadow-md">
                  <button
                    onClick={() => { createPreset("PERSONAL"); setAddMenuOpen(false) }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-muted"
                  >
                    <User className="size-3.5" />
                    Personal preset
                  </button>
                  <button
                    onClick={() => { createPreset("COMPANY"); setAddMenuOpen(false) }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-muted"
                  >
                    <Building2 className="size-3.5" />
                    Company preset
                  </button>
                </div>
              )}
            </div>

            {/* Right side */}
            <div className="flex shrink-0 items-center gap-2">
              {editing && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Drag · Resize · Rename
                  </p>
                  <Link
                    href="/dashboard/widgets"
                    className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <LayoutGrid className="size-3.5" />
                    Library
                  </Link>
                </>
              )}
              {editing ? (
                <Button size="sm" onClick={() => setEditing(false)} className="gap-1.5">
                  <Check className="size-3.5" />
                  Done
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(true)}
                  disabled={!canEditPreset}
                  className="gap-1.5"
                >
                  <Settings2 className="size-3.5" />
                  Customize
                </Button>
              )}
            </div>
          </div>

          {/* ── Scrollable grid ──────────────────────────────────────────── */}
          <div
            ref={containerRef}
            className={cn(
              "flex-1 overflow-y-auto overflow-x-hidden",
              editing ? "select-none" : "[&_.react-resizable-handle]:hidden"
            )}
            style={{
              backgroundImage: "radial-gradient(circle, oklch(var(--border)) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          >
            {containerW > 0 && (
              <ResponsiveGridLayout
                className="layout"
                width={containerW}
                breakpoints={{ lg: 0 }}
                cols={{ lg: COLS }}
                layouts={{ lg: rglLayout }}
                rowHeight={50}
                compactor={verticalCompactor}
                dragConfig={{ enabled: editing, handle: ".widget-drag-handle" }}
                resizeConfig={{ enabled: editing }}
                onLayoutChange={onLayoutChange}
                onDragStart={(_layout: unknown, oldItem: RglItem | null) => setDraggingId(oldItem?.i ?? null)}
                onDragStop={() => setDraggingId(null)}
                margin={[16, 16]}
                containerPadding={[16, 16]}
              >
                {visibleWidgets.map((w) => {
                  const title = getTitle(w.instanceId, w.defaultTitle)
                  const filterable = SOURCE_FILTERABLE_WIDGETS.has(w.type)
                  const source = filterable ? getSource(w.instanceId) : null
                  const sourceLabel = source
                    ? sourceOptions.find((o) => o.id === source)?.label ?? source
                    : null
                  return (
                    <div
                      key={w.instanceId}
                      className={cn(
                        "relative h-full",
                        editing && "rounded-xl outline outline-2 outline-primary/30",
                        draggingId === w.instanceId && "drag-glow"
                      )}
                    >
                      {/* Provider scope: a quiet badge when set, an editable
                          dropdown in Customize mode. */}
                      {filterable && !editing && sourceLabel && (
                        <span className="absolute right-2 top-2 z-20 flex items-center gap-1 rounded-full border border-border bg-card/95 px-2 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
                          <Filter className="size-2.5" />
                          {sourceLabel}
                        </span>
                      )}
                      {filterable && editing && (
                        <select
                          value={source ?? ""}
                          onChange={(e) => setSource(w.instanceId, e.target.value || null)}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="absolute right-2 top-2 z-40 max-w-[55%] truncate rounded-md border border-primary/40 bg-card/95 px-2 py-1 text-[10px] font-medium text-foreground shadow-sm backdrop-blur-sm focus:outline-none"
                          title="Filter this widget by API source"
                        >
                          <option value="">All sources</option>
                          {sourceOptions.map((o) => (
                            <option key={o.id} value={o.id}>{o.label}</option>
                          ))}
                        </select>
                      )}
                      {editing && (
                        <>
                          {/* Dedicated drag handle — the only place that starts a drag,
                              so chart tooltips and in-widget settings stay clickable. */}
                          <button
                            type="button"
                            className="widget-drag-handle absolute left-1/2 top-2 z-30 flex -translate-x-1/2 cursor-grab items-center gap-1 rounded-full border border-primary/40 bg-card/95 px-2.5 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground active:cursor-grabbing"
                            title="Drag to move"
                          >
                            <GripHorizontal className="size-3" />
                            Move
                          </button>
                          <RenameOverlay
                            title={title}
                            onChange={(t) => setTitle(w.instanceId, t)}
                          />
                        </>
                      )}
                      <div className={cn("h-full", w.centerContent && "flex items-center [&>*]:w-full")}>
                        {w.content}
                      </div>
                    </div>
                  )
                })}
              </ResponsiveGridLayout>
            )}
          </div>

        </div>
      </DashboardConfigContext.Provider>
    </DashboardEditContext.Provider>
  )
}
