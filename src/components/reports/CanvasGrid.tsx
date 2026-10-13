"use client"

import type { MutableRefObject } from "react"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ResponsiveGridLayout, verticalCompactor } = require("react-grid-layout")
import "react-grid-layout/css/styles.css"
import "react-resizable/css/styles.css"
import { GripHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { COLS, type ReportSectionEntry, type RglItem } from "./canvas-layout"

type Props = {
  width: number
  layout: RglItem[]
  sections: ReportSectionEntry[]
  editing: boolean
  onLayoutChange: (current: RglItem[]) => void
  contentEls: MutableRefObject<Map<string, HTMLDivElement>>
}

export function CanvasGrid({ width, layout, sections, editing, onLayoutChange, contentEls }: Props) {
  return (
    <ResponsiveGridLayout
      className="layout"
      width={width}
      breakpoints={{ lg: 0 }}
      cols={{ lg: COLS }}
      layouts={{ lg: layout }}
      rowHeight={50}
      compactor={verticalCompactor}
      dragConfig={{ enabled: editing, handle: ".widget-drag-handle" }}
      resizeConfig={{ enabled: editing }}
      onLayoutChange={onLayoutChange}
      margin={[16, 16]}
      containerPadding={[0, 0]}
    >
      {sections.map((s) => (
        <div
          key={s.id}
          className={cn(
            "relative h-full overflow-hidden",
            editing && "rounded-xl outline outline-2 outline-primary/30"
          )}
        >
          {editing && (
            <button
              type="button"
              className="widget-drag-handle absolute right-2 top-2 z-30 flex cursor-grab items-center gap-1 rounded-md border border-primary/40 bg-card/95 px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground active:cursor-grabbing"
              title="Drag to move"
            >
              <GripHorizontal className="size-3" />
              Move
            </button>
          )}
          <div
            ref={(node) => {
              if (node) contentEls.current.set(s.id, node)
              else contentEls.current.delete(s.id)
            }}
            className="h-full overflow-hidden"
          >
            {s.content}
          </div>
        </div>
      ))}
    </ResponsiveGridLayout>
  )
}
