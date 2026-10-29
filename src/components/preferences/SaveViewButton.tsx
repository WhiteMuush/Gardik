"use client"

import { useState } from "react"
import { Bookmark, BookmarkCheck } from "lucide-react"
import type { SavedView, ViewPage } from "@/lib/preferences/views"

const sameView = (a: SavedView, b: SavedView) =>
  JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort())

// Empty filters are dropped, so "All" and "nothing saved" compare equal.
const compact = (view: SavedView) => Object.fromEntries(Object.entries(view).filter(([, v]) => v !== ""))

type Props = { page: ViewPage; current: SavedView; saved: SavedView | undefined }

export function SaveViewButton({ page, current, saved }: Props) {
  const [stored, setStored] = useState<SavedView>(saved ?? {})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isSaved = sameView(compact(current), stored)

  async function save() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/account/views/${page}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(current),
    }).catch(() => null)
    setBusy(false)
    if (!res?.ok) {
      setError("Could not save this view")
      return
    }
    setStored(((await res.json()) as { view: SavedView }).view)
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void save()}
        disabled={busy || isSaved}
        title={isSaved ? "This is your default view" : "Open this page with these filters next time"}
        className="flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-60"
      >
        {isSaved ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4" />}
        {isSaved ? "Default view" : "Save as my default view"}
      </button>
      {error ? <span className="text-xs text-severity-critical-fg">{error}</span> : null}
    </span>
  )
}
