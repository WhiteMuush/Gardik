"use client"

import { PasswordInput } from "@/components/ui/password-input"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/invitation"

// Only ever rendered on the pre-dashboard gate. Changing a password is not a
// self-service action in this product: a user who wants a new one asks an
// administrator, who requires a rotation, which is what brings them here. The
// API enforces that too, so the rule does not depend on this component being
// the only caller.
export function PasswordChange({ required, continueTo }: { required: boolean; continueTo: string }) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    // Full navigation, not a router push: the flag lives on the session and the
    // gate re-reads it to decide what is still owed.
    window.location.assign(continueTo)
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-border/60 bg-card p-4">
      <p className="text-xs text-muted-foreground">
        {required
          ? "Every other session of yours is signed out when you save."
          : "Changing it signs out every other session."}
      </p>
      <PasswordInput
        autoComplete="current-password"
        required
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        placeholder="Current password"
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
      />
      <PasswordInput
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder={`New password (${MIN_PASSWORD_LENGTH} characters minimum)`}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
      />
      <PasswordInput
        autoComplete="new-password"
        required
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        placeholder="Repeat the new password"
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
      />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving..." : "Save and continue"}
      </Button>
      {error ? <p className="text-xs text-severity-critical">{error}</p> : null}
    </form>
  )
}
