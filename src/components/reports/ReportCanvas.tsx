"use client"

import { useState, useCallback, useEffect, useRef, type ReactNode } from "react"
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Settings2, Check, GripVertical, Eye, EyeOff, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "datashield:reports:layout:v2"

export type Span = 4 | 6 | 12

export type ReportSectionEntry = {
  id: string
  title: string
  content: ReactNode
  defaultSpan?: Span
}

type Saved = { order: string[]; spans: Record<string, Span>; hidden: string[] }

const SPAN_CLASS: Record<Span, string> = {
  4: "col-span-12 md:col-span-4",
  6: "col-span-12 md:col-span-6",
  12: "col-span-12",
}

const SPAN_OPTIONS: { value: Span; label: string }[] = [
  { value: 4, label: "1/3" },
  { value: 6, label: "1/2" },
  { value: 12, label: "Full" },
]

function SortableSection({
  section,
  span,
  editing,
  onSpan,
}: {
  section: ReportSectionEntry
  span: Span
  editing: boolean
  onSpan: (span: Span) => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id, disabled: !editing })

  return (
    <div
      ref={setNodeRef}
      data-section-id={section.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        SPAN_CLASS[span],
        "relative",
        isDragging && "opacity-0",
        editing && "rounded-xl outline outline-2 outline-primary/30",
      )}
    >
      {editing && (
        <div className="absolute right-2 top-2 z-30 flex items-center gap-1">
          <div className="flex items-center overflow-hidden rounded-md border border-border bg-card/95 shadow-sm backdrop-blur-sm">
            {SPAN_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => onSpan(o.value)}
                className={cn(
                  "px-2 py-1 text-[10px] font-medium transition-colors",
                  span === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
                title={`Width: ${o.label}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            className="flex cursor-grab items-center gap-1 rounded-md border border-primary/40 bg-card/95 px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground active:cursor-grabbing"
            title="Drag to reorder"
          >
            <GripVertical className="size-3" />
            Move
          </button>
        </div>
      )}
      {section.content}
    </div>
  )
}

export function ReportCanvas({ sections }: { sections: ReportSectionEntry[] }) {
  const [editing, setEditing] = useState(false)
  const [order, setOrder] = useState<string[]>(() => sections.map((s) => s.id))
  const [spans, setSpans] = useState<Record<string, Span>>(
    () => Object.fromEntries(sections.map((s) => [s.id, s.defaultSpan ?? 12])),
  )
  const [hidden, setHidden] = useState<string[]>([])
  const [sectionsMenuOpen, setSectionsMenuOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overlayW, setOverlayW] = useState<number>()
  const menuRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved: Saved = JSON.parse(raw)
      const ids = new Set(sections.map((s) => s.id))
      const savedOrder = (saved.order ?? []).filter((id) => ids.has(id))
      const missing = sections.map((s) => s.id).filter((id) => !savedOrder.includes(id))
      setOrder([...savedOrder, ...missing])
      setSpans((prev) => ({ ...prev, ...saved.spans }))
      setHidden((saved.hidden ?? []).filter((id) => ids.has(id)))
    } catch {
      /* ignore corrupt storage */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!sectionsMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setSectionsMenuOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [sectionsMenuOpen])

  const persist = useCallback((next: Partial<Saved>) => {
    try {
      const cur: Saved = { order, spans, hidden, ...next }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cur))
    } catch {
      /* storage unavailable */
    }
  }, [order, spans, hidden])

  const byId = new Map(sections.map((s) => [s.id, s]))
  const visibleOrder = order.filter((id) => !hidden.includes(id))

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id as string)
    const el = gridRef.current?.querySelector(`[data-section-id="${e.active.id}"]`)
    setOverlayW(el?.getBoundingClientRect().width)
  }

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    setOrder((prev) => {
      const next = arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(over.id as string))
      persist({ order: next })
      return next
    })
  }

  const setSpan = (id: string, span: Span) => {
    setSpans((prev) => {
      const next = { ...prev, [id]: span }
      persist({ spans: next })
      return next
    })
  }

  const toggleHidden = (id: string) => {
    setHidden((prev) => {
      const next = prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]
      persist({ hidden: next })
      return next
    })
  }

  const reset = () => {
    const o = sections.map((s) => s.id)
    const sp = Object.fromEntries(sections.map((s) => [s.id, s.defaultSpan ?? 12])) as Record<string, Span>
    setOrder(o)
    setSpans(sp)
    setHidden([])
    persist({ order: o, spans: sp, hidden: [] })
  }

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      <div className="no-print mb-3 flex shrink-0 items-center justify-end gap-2">
        {editing && (
          <>
            <p className="mr-auto text-xs text-muted-foreground">Drag to reorder, set width, toggle sections</p>
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setSectionsMenuOpen((o) => !o)}
                className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Eye className="size-3.5" />
                Sections
              </button>
              {sectionsMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-md border border-border bg-popover p-1 shadow-md">
                  {sections.map((s) => {
                    const isHidden = hidden.includes(s.id)
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggleHidden(s.id)}
                        className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs hover:bg-muted"
                      >
                        {isHidden ? <EyeOff className="size-3.5 text-muted-foreground" /> : <Eye className="size-3.5 text-primary" />}
                        <span className={cn(isHidden && "text-muted-foreground")}>{s.title}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <button
              onClick={reset}
              className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="size-3.5" />
              Reset
            </button>
          </>
        )}
        {editing ? (
          <Button size="sm" onClick={() => setEditing(false)} className="gap-1.5">
            <Check className="size-3.5" />
            Done
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
            <Settings2 className="size-3.5" />
            Customize
          </Button>
        )}
      </div>

      {/* Flow grid (screen) */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <SortableContext items={visibleOrder} strategy={rectSortingStrategy}>
          <div ref={gridRef} className="no-print grid grid-cols-12 items-start gap-4">
            {visibleOrder.map((id) => {
              const section = byId.get(id)
              if (!section) return null
              return (
                <SortableSection
                  key={id}
                  section={section}
                  span={spans[id] ?? section.defaultSpan ?? 12}
                  editing={editing}
                  onSpan={(span) => setSpan(id, span)}
                />
              )
            })}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeId ? (
            <div style={{ width: overlayW }} className="rounded-xl outline outline-2 outline-primary/50">
              {byId.get(activeId)?.content}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
