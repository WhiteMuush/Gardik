import { Lock } from "lucide-react"

// Shown instead of a redirect, so users learn their role is the reason without learning what the page holds.
export function NoAccess() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <Lock className="mx-auto size-6 text-muted-foreground" />
        <h2 className="mt-3 text-base font-semibold text-foreground">Not available to your role</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask an administrator if you need access to this section.
        </p>
      </div>
    </div>
  )
}
