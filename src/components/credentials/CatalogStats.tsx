import { cn } from "@/lib/utils"
import { formatScan } from "./source-view"

// The three headline numbers; "Needs action" filters the grid when clicked.
export function CatalogStats(props: {
  connectedLabel: string
  lastLabel: string
  connected: number
  total: number
  lastScanAt: string | null
  needsAction: number
  onNeedsAction: () => void
}) {
  const { connectedLabel, lastLabel, connected, total, lastScanAt, needsAction, onNeedsAction } = props
  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">{connectedLabel}</p>
        <p className="mt-1 text-xl font-semibold text-foreground">
          {connected} <span className="text-sm font-normal text-muted-foreground">of {total}</span>
        </p>
      </div>
      <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">{lastLabel}</p>
        <p className="mt-1 text-xl font-semibold text-foreground">{formatScan(lastScanAt)}</p>
      </div>
      <button
        type="button"
        onClick={onNeedsAction}
        disabled={needsAction === 0}
        className={cn(
          "rounded-xl border px-4 py-3 text-left transition-colors",
          needsAction > 0
            ? "border-destructive/40 bg-destructive/5 hover:bg-destructive/10"
            : "border-border/60 bg-card"
        )}
      >
        <p className="text-xs text-muted-foreground">Needs action</p>
        <p
          className={cn(
            "mt-1 text-xl font-semibold",
            needsAction > 0 ? "text-destructive" : "text-foreground"
          )}
        >
          {needsAction}
        </p>
      </button>
    </div>
  )
}
