"use client"

import { useState } from "react"
import { passkey, useListPasskeys } from "@/lib/auth/client"
import { Button } from "@/components/ui/button"

export function PasskeySetup() {
  const { data: passkeys, isPending } = useListPasskeys()
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function add() {
    setError(null)
    setBusy(true)
    try {
      // Opens the platform authenticator (Face ID / Windows Hello / security key).
      const res = await passkey.addPasskey({ name: name.trim() || undefined })
      if (res?.error) {
        setError("Could not register a passkey. Please try again.")
        return
      }
      setName("")
    } catch {
      setError("Could not register a passkey. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setError(null)
    await passkey.deletePasskey({ id })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this device (optional)"
          className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
        />
        <Button onClick={add} disabled={busy}>
          {busy ? "Waiting for your device..." : "Add a passkey"}
        </Button>
      </div>

      {!isPending && passkeys && passkeys.length > 0 && (
        <ul className="space-y-1.5">
          {passkeys.map((pk) => (
            <li
              key={pk.id}
              className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm"
            >
              <span className="text-foreground">{pk.name || "Passkey"}</span>
              <button
                type="button"
                onClick={() => remove(pk.id)}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
