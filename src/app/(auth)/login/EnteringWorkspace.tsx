import { Loader2, ShieldCheck } from "lucide-react"

// Shown only once authentication succeeded, to cover the slow gap before the workspace paints.
export function EnteringWorkspace() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background"
    >
      <ShieldCheck aria-hidden className="size-10 animate-pulse text-primary" />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 aria-hidden className="size-4 animate-spin" />
        Opening your workspace...
      </div>
    </div>
  )
}
