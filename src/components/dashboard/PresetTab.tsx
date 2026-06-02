"use client"

import { useState, useEffect, useRef } from "react"
import { Pencil, Trash2, Building2, User } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DashboardPreset } from "@/types/dashboard"

export function PresetTab({
  preset,
  active,
  canDelete,
  canRename,
  onClick,
  onRename,
  onDelete,
}: {
  preset: DashboardPreset
  active: boolean
  canDelete: boolean
  canRename: boolean
  onClick: () => void
  onRename: (name: string) => void
  onDelete: () => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(preset.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renaming) {
      setDraft(preset.name)
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 10)
    }
  }, [renaming, preset.name])

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== preset.name) onRename(trimmed)
    setRenaming(false)
  }

  return (
    <div
      className={cn(
        "group flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors cursor-pointer select-none",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
      onClick={onClick}
    >
      {preset.scope === "COMPANY" ? (
        <Building2 className="size-3 shrink-0 opacity-70" />
      ) : (
        <User className="size-3 shrink-0 opacity-60" />
      )}

      {renaming ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
            if (e.key === "Escape") setRenaming(false)
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-24 bg-transparent outline-none"
        />
      ) : (
        <span className="max-w-[120px] truncate">{preset.name}</span>
      )}

      {active && !renaming && (
        <div className="ml-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {canRename && (
            <button
              onClick={(e) => { e.stopPropagation(); setRenaming(true) }}
              className="rounded p-0.5 hover:bg-white/20"
            >
              <Pencil className="size-2.5" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="rounded p-0.5 hover:bg-white/20"
            >
              <Trash2 className="size-2.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
