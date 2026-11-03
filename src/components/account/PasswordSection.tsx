"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PasswordInput } from "@/components/ui/password-input"
import { Button } from "@/components/ui/button"
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/invitation"
import { useStepUpRetry } from "./useStepUpRetry"

const inputClass = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"

type Props = { hasPassword: boolean; twoFactorEnabled: boolean; canEnrollTwoFactor: boolean }

export function PasswordSection({ hasPassword, twoFactorEnabled, canEnrollTwoFactor }: Props) {
  const router = useRouter()
  const { run, dialog } = useStepUpRetry()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  if (!hasPassword) {
    return (
      <p className="text-sm text-muted-foreground">
        You sign in through your company&apos;s identity provider, so there is no password to change here.
      </p>
    )
  }
  // Mirrors the API rule: without 2FA, a stolen password could otherwise be used to lock the owner out.
  if (!twoFactorEnabled) {
    return (
      <p className="text-sm text-muted-foreground">
        {canEnrollTwoFactor
          ? "Turn on two-factor authentication below to change your password here, or ask an administrator to require a password change."
          : "Ask an administrator to require a password change. Changing it here needs two-factor authentication, which this company does not offer yet."}
      </p>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (next !== confirmation) {
      setMessage({ ok: false, text: "The two new passwords do not match" })
      return
    }
    setBusy(true)
    const res = await run(() =>
      fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
    )
    setBusy(false)
    if (!res) return
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setMessage({ ok: false, text: body.error ?? "Could not change your password" })
      return
    }
    setCurrent("")
    setNext("")
    setConfirmation("")
    setMessage({ ok: true, text: "Password changed. Your other sessions were signed out." })
    router.refresh()
  }

  return (
    <>
      <form onSubmit={(e) => void submit(e)} className="space-y-2 sm:max-w-sm">
        <PasswordInput
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="Current password"
          className={inputClass}
        />
        <PasswordInput
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder={`New password (${MIN_PASSWORD_LENGTH} characters minimum)`}
          className={inputClass}
        />
        <PasswordInput
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder="Repeat the new password"
          className={inputClass}
        />
        <Button type="submit" disabled={busy}>
          {busy ? "Saving..." : "Change password"}
        </Button>
        {message ? (
          <p className={message.ok ? "text-xs text-muted-foreground" : "text-xs text-severity-critical-fg"}>
            {message.text}
          </p>
        ) : null}
      </form>
      {dialog}
    </>
  )
}
