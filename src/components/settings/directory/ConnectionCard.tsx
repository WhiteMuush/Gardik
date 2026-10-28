import { RefreshCw, Trash2, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { TYPE_META, STATUS_DOT, STATUS_LABEL, formatDate, type Connection } from "./meta"

type Props = {
  conn: Connection
  isAdmin: boolean
  isSyncing: boolean
  isDeleting: boolean
  onSync: (id: string) => void
  onDelete: (id: string) => void
}

export function ConnectionCard({ conn, isAdmin, isSyncing, isDeleting, onSync, onDelete }: Props) {
  const meta = TYPE_META[conn.type]

  return (
    <div className="flex items-start gap-4 rounded-xl border border-border/60 bg-card px-4 py-4">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", meta.color)}>
        {meta.icon}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">{conn.name}</p>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              meta.color
            )}
          >
            {meta.label}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn("size-1.5 rounded-full", STATUS_DOT[conn.status])} />
          <span className="text-xs text-muted-foreground">{STATUS_LABEL[conn.status]}</span>
          <span className="text-xs text-muted-foreground">-</span>
          <span className="text-xs text-muted-foreground">Last sync: {formatDate(conn.lastSyncAt)}</span>
          {conn.lastSyncCount !== null && (
            <>
              <span className="text-xs text-muted-foreground">-</span>
              <span className="text-xs text-muted-foreground">
                {conn.lastSyncCount} employee{conn.lastSyncCount !== 1 ? "s" : ""}
              </span>
            </>
          )}
        </div>

        {conn.status === "ERROR" && conn.errorMessage && (
          <div className="mt-2 flex items-start gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5">
            <AlertCircle className="mt-0.5 size-3 shrink-0 text-destructive" />
            <p className="text-xs text-destructive">{conn.errorMessage}</p>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="flex shrink-0 gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSync(conn.id)}
            disabled={isSyncing || isDeleting}
          >
            {isSyncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            <span className="ml-1.5">{isSyncing ? "Syncing..." : "Sync now"}</span>
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={() => onDelete(conn.id)}
            disabled={isDeleting || isSyncing}
          >
            {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          </Button>
        </div>
      )}
    </div>
  )
}
