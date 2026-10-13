"use client"

import { Filter, GripHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { RenameOverlay } from "../RenameOverlay"
import type { SourceOption, WidgetEntry } from "./types"

type Props = {
  w: WidgetEntry
  editing: boolean
  title: string
  filterable: boolean
  source: string | null
  sourceLabel: string | null
  sourceOptions: SourceOption[]
  setSource: (instanceId: string, source: string | null) => void
  setTitle: (instanceId: string, title: string) => void
}

// The controls floating over one widget: source badge or filter, drag handle and rename, then its content.
export function WidgetCell({
  w,
  editing,
  title,
  filterable,
  source,
  sourceLabel,
  sourceOptions,
  setSource,
  setTitle,
}: Props) {
  return (
    <>
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
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {editing && (
        <>
          {/* The only drag start, so chart tooltips and in-widget settings stay clickable. */}
          <button
            type="button"
            className="widget-drag-handle absolute left-1/2 top-2 z-30 flex -translate-x-1/2 cursor-grab items-center gap-1 rounded-full border border-primary/40 bg-card/95 px-2.5 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground active:cursor-grabbing"
            title="Drag to move"
          >
            <GripHorizontal className="size-3" />
            Move
          </button>
          <RenameOverlay title={title} onChange={(t) => setTitle(w.instanceId, t)} />
        </>
      )}
      <div className={cn("h-full", w.centerContent && "flex items-center [&>*]:w-full")}>{w.content}</div>
    </>
  )
}
