"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"

// Stands in front of the account section until the caller proves it is them
// again. A live session is not enough here: this is where a session can be
// turned into lasting access (a new authenticator, a passkey, an identity
// provider), so an unlocked screen somebody walked away from should not be.
export function StepUpGate({ hasPassword, hasTwoFactor }: { hasPassword: boolean; hasTwoFactor: boolean }) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch("/api/rbac/step-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(password ? { password } : { code }),
    })
    setBusy(false)
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Failed")
      return
    }
    setPassword("")
    setCode("")
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="max-w-sm space-y-3 rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2">
        <Lock className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-foreground">Confirm it is you</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        {hasPassword && hasTwoFactor
          ? "Enter your password, or a code from your authenticator."
          : hasPassword
            ? "Enter your password to open your account settings."
            : "Enter a code from your authenticator to open your account settings."}
      </p>
      {hasPassword ? (
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
      ) : null}
      {hasTwoFactor ? (
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="6-digit code"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
      ) : null}
      <Button type="submit" disabled={busy || (password === "" && code === "")}>
        {busy ? "Checking..." : "Continue"}
      </Button>
      {error ? <p className="text-xs text-severity-critical">{error}</p> : null}
    </form>
  )
}
