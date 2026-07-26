"use client"

import { useState } from "react"

// Shown when a mutation returns 403 with code STEP_UP_REQUIRED. Re-verifies the
// password against POST /api/rbac/step-up, then calls onVerified so the caller
// can retry the original request.
export function StepUpDialog({
  open,
  onVerified,
  onCancel,
}: {
  open: boolean
  onVerified: () => void
  onCancel: () => void
}) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  async function submit() {
    setBusy(true)
    setError(null)
    const res = await fetch("/api/rbac/step-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
    setBusy(false)
    if (!res.ok) {
      setError("Incorrect password")
      return
    }
    setPassword("")
    onVerified()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-foreground">Confirm it is you</h3>
        <p className="text-xs text-muted-foreground">
          This is a sensitive change. Re-enter your password to continue.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Checking..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  )
}
