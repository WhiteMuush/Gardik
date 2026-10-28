import { cn } from "@/lib/utils"
import { SourceAvatar } from "@/components/credentials/SourceBadges"
import type { DirectoryStatus, DirectoryView } from "./directory-view"

const PILL: Record<DirectoryStatus, { label: string; pill: string; dot: string }> = {
  ACTIVE: {
    label: "Active",
    pill: "bg-green-500/10 text-green-700 dark:text-green-400",
    dot: "bg-green-500",
  },
  ERROR: { label: "Sync error", pill: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  PENDING: {
    label: "Pending test",
    pill: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    dot: "bg-yellow-500",
  },
  NOT_CONNECTED: {
    label: "Not connected",
    pill: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
}

export function DirectoryStatusPill({ status }: { status: DirectoryStatus }) {
  const p = PILL[status]
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", p.pill)}
    >
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", p.dot)} />
      {p.label}
    </span>
  )
}

export function connectionCount(view: DirectoryView): string {
  const n = view.connections.length
  return n === 0 ? "No connection" : `${n} connection${n > 1 ? "s" : ""}`
}

export function DirectoryTile({ view, onOpen }: { view: DirectoryView; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col rounded-xl border border-border/60 bg-card p-4 text-left transition-all hover:border-primary/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-3">
        <SourceAvatar initials={view.initials} logo={view.logo} />
        <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">{view.provider.label}</p>
      </div>
      <p className="mt-3 line-clamp-2 flex-1 text-xs text-muted-foreground">{view.provider.description}</p>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
        <span className="text-xs text-foreground">{connectionCount(view)}</span>
        <DirectoryStatusPill status={view.status} />
      </div>
    </button>
  )
}
