"use client"

import { useState, useEffect, useRef } from "react"
import { Settings2, Check, Eye, EyeOff, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ReportSectionEntry } from "./canvas-layout"

type Props = {
  sections: ReportSectionEntry[]
  hidden: string[]
  editing: boolean
  setEditing: (editing: boolean) => void
  toggleHidden: (id: string) => void
  reset: () => void
}

export function CanvasToolbar({ sections, hidden, editing, setEditing, toggleHidden, reset }: Props) {
  const [sectionsMenuOpen, setSectionsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sectionsMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setSectionsMenuOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [sectionsMenuOpen])

  return (
    <div className="no-print mb-3 flex shrink-0 items-center justify-end gap-2">
      {editing && (
        <>
          <p className="mr-auto text-xs text-muted-foreground">Drag to move, resize, toggle sections</p>
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
                      {isHidden ? (
                        <EyeOff className="size-3.5 text-muted-foreground" />
                      ) : (
                        <Eye className="size-3.5 text-primary" />
                      )}
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
  )
}
