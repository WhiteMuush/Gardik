"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/invitation"

export function PasswordChange({ required }: { required: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword !== confirmation) {
      setError("The two new passwords do not match")
      return
    }
    setPending(true)
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    setPending(false)
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Failed")
      return
    }
    setCurrentPassword("")
    setNewPassword("")
    setConfirmation("")
    setDone(true)
    // The forced-rotation banner and the API gate both read the session, and
    // the flag only clears on the server, so reload rather than pretend here.
    if (required) window.location.assign("/dashboard")
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <h3 className="text-sm font-medium text-foreground">Password</h3>
      {required ? (
        <p className="mt-1 text-xs text-severity-critical">
          An administrator requires you to choose a new password. Nothing else in the
          application is available until you do.
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          Changing it signs out every other session.
        </p>
      )}
      <form onSubmit={submit} className="mt-3 space-y-2">
        <input
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Current password"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={`New password (${MIN_PASSWORD_LENGTH} characters minimum)`}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
        <input
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder="Repeat the new password"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Change password"}
        </Button>
        {error ? <p className="text-xs text-severity-critical">{error}</p> : null}
        {done && !required ? (
          <p className="text-xs text-muted-foreground">Password changed.</p>
        ) : null}
      </form>
    </div>
  )
}
