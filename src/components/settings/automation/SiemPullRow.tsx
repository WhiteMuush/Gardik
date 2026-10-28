"use client"

import { useState } from "react"
import { Copy, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SettingRow } from "./SettingRow"

type Props = {
  companyId: string
  tokenHint: string | null
  isAdmin: boolean
}

function generateToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

export function SiemPullRow({ companyId, tokenHint, isAdmin }: Props) {
  const [hint, setHint] = useState(tokenHint)
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const feedUrl = `${origin}/api/integrations/siem/${companyId}?format=cef`

  async function rotate() {
    const fresh = generateToken()
    setBusy(true)
    const res = await fetch("/api/company", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siemToken: fresh }),
    })
    setBusy(false)
    if (res.ok) {
      setToken(fresh)
      setHint(`...${fresh.slice(-4)}`)
      setOpen(true)
    }
  }

  return (
    <SettingRow
      title="SIEM pull feed"
      description="Splunk, Microsoft Sentinel or any collector polls Gardik for new alerts."
      status={{ on: hint !== null, label: hint ? `Token ${hint}` : "No token" }}
      action={
        isAdmin && (
          <Button size="sm" variant="outline" onClick={() => void rotate()} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {hint ? "Rotate token" : "Generate token"}
          </Button>
        )
      }
      open={open}
      onToggle={() => setOpen(!open)}
    >
      {token && (
        <p className="break-all rounded-md bg-muted px-3 py-2 text-xs text-foreground">
          Copy now, it will not be shown again: <span className="font-mono">{token}</span>
        </p>
      )}
      <div>
        <label htmlFor="siem-feed" className="mb-1 block text-xs font-medium text-muted-foreground">
          Feed endpoint
        </label>
        <div className="flex items-center gap-2">
          <input
            id="siem-feed"
            readOnly
            value={feedUrl}
            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground"
          />
          <Button
            size="icon"
            variant="outline"
            aria-label="Copy feed endpoint"
            onClick={() => void navigator.clipboard?.writeText(feedUrl)}
          >
            <Copy className="size-3.5" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Send the token as a bearer token. Formats: <code>cef</code>, <code>syslog</code> or <code>json</code>,
        set with the <code>format</code> query parameter.
      </p>
    </SettingRow>
  )
}
