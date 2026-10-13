"use client"

import { useState, useCallback, useRef } from "react"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ResponsiveGridLayout } = require("react-grid-layout")
import "react-grid-layout/css/styles.css"
import "react-resizable/css/styles.css"
import { cn } from "@/lib/utils"
import { SaveErrorBar } from "./SaveErrorBar"
import { useCtrlWheelZoom } from "./useCtrlWheelZoom"
import { DashboardEditContext } from "@/contexts/DashboardEditContext"
import { DashboardConfigContext } from "@/contexts/DashboardConfigContext"
import { DetailDrawerProvider } from "@/contexts/DetailDrawerContext"
import { type DashboardPreset, SOURCE_FILTERABLE_WIDGETS } from "@/types/dashboard"
import { COLS, buildRglLayout, type SourceOption, type WidgetEntry } from "./canvas/types"
import { usePresets } from "./canvas/usePresets"
import { useGridGestures } from "./canvas/useGridGestures"
import { Toolbar } from "./canvas/Toolbar"
import { WidgetCell } from "./canvas/WidgetCell"
import { useContentSize } from "./canvas/useContentSize"

export type { SourceOption, WidgetEntry } from "./canvas/types"

export function DashboardCanvas({
  widgets,
  presets: initialPresets,
  activePresetId: initialActivePresetId,
  canManageShared,
  visible,
  sourceOptions = [],
}: {
  widgets: WidgetEntry[]
  presets: DashboardPreset[]
  activePresetId: string | null
  /** Mirrors dashboard:manage_shared, the permission the preset routes themselves check. */
  canManageShared: boolean
  /** Paths this role may open, resolved server-side. */
  visible: string[]
  sourceOptions?: SourceOption[]
}) {
  const [editing, setEditing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const containerW = useContentSize(containerRef, "width")
  const gridInnerRef = useRef<HTMLDivElement>(null)
  // The unscaled grid height, so the scroll area matches the zoomed view.
  const naturalH = useContentSize(gridInnerRef, "height")
  // Extra rows while an in-widget editor is open; never saved, it only pushes neighbours down.
  const [extraRows, setExtraRows] = useState<Record<string, number>>({})
  const [zoomLevel, setZoomLevel] = useState(1)
  const presetsState = usePresets(widgets, initialPresets, initialActivePresetId)
  const { activePreset, layout, meta, getTitle, getSource, setTitle, setSource } = presetsState
  const gestures = useGridGestures({
    layout,
    setLayout: presetsState.setLayout,
    editing,
    activePreset,
    meta,
    persistPreset: presetsState.persistPreset,
    extraRows,
  })

  useCtrlWheelZoom(containerRef, editing, setZoomLevel)

  const requestRows = useCallback((instanceId: string, rows: number) => {
    setExtraRows((prev) => {
      if ((prev[instanceId] ?? 0) === rows) return prev
      const next = { ...prev }
      if (rows > 0) next[instanceId] = rows
      else delete next[instanceId]
      return next
    })
  }, [])

  const visibleWidgets = widgets.filter((w) => {
    const m = meta.find((m) => m.instanceId === w.instanceId)
    return m?.visible !== false
  })
  const rglLayout = buildRglLayout(visibleWidgets, layout, extraRows)
  const canEditPreset = activePreset ? activePreset.scope === "PERSONAL" || canManageShared : false

  // Editing always renders at 1x so RGL's drag/resize pointer math stays correct.
  const zoom = editing ? 1 : zoomLevel
  const scaledWidth = containerW > 0 ? containerW / zoom : 0

  return (
    <DetailDrawerProvider>
      <DashboardEditContext.Provider value={editing}>
        <DashboardConfigContext.Provider value={{ getTitle, setTitle, editing, requestRows }}>
          <div className="flex flex-1 flex-col min-h-0">
            <SaveErrorBar failure={presetsState.failure} onDismiss={presetsState.dismiss} />
            <Toolbar
              presets={presetsState.presets}
              activePreset={activePreset}
              canManageShared={canManageShared}
              canEditPreset={canEditPreset}
              visible={visible}
              editing={editing}
              setEditing={setEditing}
              switchPreset={presetsState.switchPreset}
              renamePreset={presetsState.renamePreset}
              deletePreset={presetsState.deletePreset}
              createPreset={presetsState.createPreset}
              reset={presetsState.reset}
            />

            <div
              ref={containerRef}
              className={cn(
                "flex-1 overflow-y-auto overflow-x-hidden",
                // Extra top room in Customize so the first row's floating controls clear the toolbar.
                editing ? "select-none pt-6" : "[&_.react-resizable-handle]:hidden"
              )}
              style={{
                backgroundImage: "radial-gradient(circle, oklch(var(--border)) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            >
              {containerW > 0 && (
                // The spacer reserves the scaled footprint; the inner layer is the grid, scaled in place.
                <div
                  style={{
                    position: "relative",
                    width: containerW,
                    height: naturalH ? naturalH * zoom : undefined,
                  }}
                >
                  <div
                    ref={gridInnerRef}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: scaledWidth,
                      transformOrigin: "top left",
                      transform: `scale(${zoom})`,
                    }}
                  >
                    <ResponsiveGridLayout
                      className="layout"
                      width={scaledWidth}
                      breakpoints={{ lg: 0 }}
                      cols={{ lg: COLS }}
                      layouts={{ lg: rglLayout }}
                      rowHeight={50}
                      compactor={gestures.compactor}
                      dragConfig={{ enabled: editing, handle: ".widget-drag-handle" }}
                      resizeConfig={{ enabled: editing }}
                      onDragStart={gestures.onDragStart}
                      onDrag={gestures.onDrag}
                      onDragStop={gestures.onDragStop}
                      onResizeStart={gestures.onResizeStart}
                      onResizeStop={gestures.onResizeStop}
                      margin={[16, 16]}
                      containerPadding={[16, 16]}
                    >
                      {visibleWidgets.map((w) => {
                        const title = getTitle(w.instanceId, w.defaultTitle)
                        const filterable = SOURCE_FILTERABLE_WIDGETS.has(w.type)
                        const source = filterable ? getSource(w.instanceId) : null
                        const sourceLabel = source
                          ? (sourceOptions.find((o) => o.id === source)?.label ?? source)
                          : null
                        return (
                          <div
                            key={w.instanceId}
                            className={cn(
                              "relative h-full",
                              // RGL gives each item its own stacking context, so the hovered and dragged ones are lifted.
                              editing && "rounded-xl outline outline-2 outline-primary/30 hover:z-20",
                              gestures.swapTargetId === w.instanceId &&
                                "z-30 swap-glow outline-[oklch(var(--severity-critical))]",
                              // !z-50 beats RGL's two-class .react-draggable-dragging z-index rule.
                              gestures.draggingId === w.instanceId && "!z-50 drag-glow"
                            )}
                          >
                            <WidgetCell
                              w={w}
                              editing={editing}
                              title={title}
                              filterable={filterable}
                              source={source}
                              sourceLabel={sourceLabel}
                              sourceOptions={sourceOptions}
                              setSource={setSource}
                              setTitle={setTitle}
                            />
                          </div>
                        )
                      })}
                    </ResponsiveGridLayout>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DashboardConfigContext.Provider>
      </DashboardEditContext.Provider>
    </DetailDrawerProvider>
  )
}
