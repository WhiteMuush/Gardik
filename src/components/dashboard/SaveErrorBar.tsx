"use client"

import { useCallback, useState } from "react"
import { AlertTriangle, X } from "lucide-react"
import { Button } from "@/components/ui/button"

type Failure = { retry: () => void }

// Runs a save and, when it fails, keeps a way to replay the whole action.
export function useSaveGuard() {
  const [failure, setFailure] = useState<Failure | null>(null)

  const guard = useCallback((action: () => Promise<boolean>) => {
    const run = () => {
      void action().then((ok) => setFailure(ok ? null : { retry: run }))
    }
    run()
  }, [])

  const dismiss = useCallback(() => setFailure(null), [])

  return { failure, guard, dismiss }
}

export function SaveErrorBar({ failure, onDismiss }: { failure: Failure | null; onDismiss: () => void }) {
  if (!failure) return null
  return (
    <div
      role="alert"
      className="flex shrink-0 items-center gap-3 border-b border-destructive/40 bg-destructive/5 px-4 py-2"
    >
      <AlertTriangle className="size-4 shrink-0 text-destructive" />
      <p className="flex-1 text-sm text-foreground">
        Your last dashboard change was not saved. It will be lost on reload unless you retry.
      </p>
      <Button size="sm" variant="outline" onClick={failure.retry}>
        Retry
      </Button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
