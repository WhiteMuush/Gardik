"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Building2, Check, LayoutGrid, Plus, RotateCcw, Settings2, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { DashboardPreset } from "@/types/dashboard"
import { PresetTab } from "../PresetTab"

type Props = {
  presets: DashboardPreset[]
  activePreset: DashboardPreset | null
  canManageShared: boolean
  canEditPreset: boolean
  visible: string[]
  editing: boolean
  setEditing: (editing: boolean) => void
  switchPreset: (preset: DashboardPreset) => void
  renamePreset: (id: string, name: string) => void
  deletePreset: (id: string) => void
  createPreset: (scope: "PERSONAL" | "COMPANY") => void
  reset: () => void
}

export function Toolbar({
  presets,
  activePreset,
  canManageShared,
  canEditPreset,
  visible,
  editing,
  setEditing,
  switchPreset,
  renamePreset,
  deletePreset,
  createPreset,
  reset,
}: Props) {
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!addMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (!addMenuRef.current?.contains(e.target as Node)) setAddMenuOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [addMenuOpen])

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
      <div className="flex flex-1 items-center gap-1.5 overflow-x-auto scrollbar-none">
        {presets.map((p) => (
          <PresetTab
            key={p.id}
            preset={p}
            active={p.id === activePreset?.id}
            canDelete={presets.length > 1 && (p.scope === "PERSONAL" || canManageShared)}
            canRename={p.scope === "PERSONAL" || canManageShared}
            onClick={() => switchPreset(p)}
            onRename={(name) => renamePreset(p.id, name)}
            onDelete={() => deletePreset(p.id)}
          />
        ))}
      </div>

      {/* Outside the overflow container so the menu is not clipped. */}
      <div ref={addMenuRef} className="relative shrink-0">
        <button
          onClick={() => (canManageShared ? setAddMenuOpen((o) => !o) : createPreset("PERSONAL"))}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Add preset"
        >
          <Plus className="size-3.5" />
        </button>
        {addMenuOpen && canManageShared && (
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-md border border-border bg-popover shadow-md">
            <button
              onClick={() => {
                createPreset("PERSONAL")
                setAddMenuOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-muted"
            >
              <User className="size-3.5" />
              Personal preset
            </button>
            <button
              onClick={() => {
                createPreset("COMPANY")
                setAddMenuOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-muted"
            >
              <Building2 className="size-3.5" />
              Company preset
            </button>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {editing && (
          <>
            <p className="text-xs text-muted-foreground">Drag - Resize - Rename</p>
            {visible.includes("/dashboard/widgets") && (
              <Link
                href="/dashboard/widgets"
                className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LayoutGrid className="size-3.5" />
                Library
              </Link>
            )}
            <button
              onClick={reset}
              disabled={!canEditPreset}
              className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
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
  )
}
