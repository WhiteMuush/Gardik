"use client"

import { useState, useEffect, useRef } from "react"
import { Pencil } from "lucide-react"

export function RenameOverlay({ title, onChange }: { title: string; onChange: (t: string) => void }) {
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renaming) {
      setDraft(title)
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 10)
    }
  }, [renaming, title])

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed) onChange(trimmed)
    setRenaming(false)
  }

  return (
    <div
      className="absolute top-2 left-2 z-20"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
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
          className="h-6 w-40 rounded border border-primary bg-card px-2 text-xs font-medium text-foreground shadow focus:outline-none"
        />
      ) : (
        <button
          onClick={() => setRenaming(true)}
          className="flex items-center gap-1 rounded bg-background/80 px-1.5 py-0.5 text-xs text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground"
        >
          <Pencil className="size-3" />
          Rename
        </button>
      )}
    </div>
  )
}
