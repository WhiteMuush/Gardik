"use client"

import { useState, useEffect, type ReactNode } from "react"
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
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Eye, EyeOff, Settings2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type Section = {
  id: string
  label: string
  content: ReactNode
}

type SectionState = {
  id: string
  visible: boolean
}

const STORAGE_KEY = "datashield-dashboard-layout"

function SortableSection({
  id,
  visible,
  editing,
  onToggle,
  children,
}: {
  id: string
  visible: boolean
  editing: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !editing })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "relative",
        isDragging && "opacity-0",
        !visible && editing && "opacity-40"
      )}
    >
      {editing && (
        <>
          <button
            {...attributes}
            {...listeners}
            className="absolute -left-9 top-1/2 -translate-y-1/2 flex size-7 cursor-grab items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
          <button
            onClick={onToggle}
            className="absolute -right-9 top-1/2 -translate-y-1/2 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </button>
        </>
      )}
      {children}
    </div>
  )
}

export function DashboardCanvas({ sections }: { sections: Section[] }) {
  const [editing, setEditing] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [layout, setLayout] = useState<SectionState[]>(
    sections.map((s) => ({ id: s.id, visible: true }))
  )

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: SectionState[] = JSON.parse(saved)
        setLayout(
          sections.map((s) => parsed.find((p) => p.id === s.id) ?? { id: s.id, visible: true })
        )
      }
    } catch {}
  }, [])

  const save = (next: SectionState[]) => {
    setLayout(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const toggle = (id: string) =>
    save(layout.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s)))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const onDragStart = ({ active }: DragStartEvent) => setActiveId(active.id as string)

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (over && active.id !== over.id) {
      const from = layout.findIndex((s) => s.id === active.id)
      const to = layout.findIndex((s) => s.id === over.id)
      save(arrayMove(layout, from, to))
    }
  }

  const ordered = layout
    .map((l) => ({ ...l, section: sections.find((s) => s.id === l.id)! }))
    .filter((s) => s.section && (s.visible || editing))

  const activeSection = sections.find((s) => s.id === activeId)

  return (
    <div className={cn("transition-all duration-200", editing && "px-10")}>
      <div className="mb-4 flex justify-end">
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={layout.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-6">
            {ordered.map(({ id, visible, section }) => (
              <SortableSection
                key={id}
                id={id}
                visible={visible}
                editing={editing}
                onToggle={() => toggle(id)}
              >
                {section.content}
              </SortableSection>
            ))}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
          {activeSection && (
            <div className="rounded-xl shadow-2xl ring-2 ring-primary/30">
              {activeSection.content}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
