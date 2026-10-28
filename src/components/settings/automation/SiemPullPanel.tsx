"use client"

import { useState } from "react"
import { Copy, FileCode, KeyRound, Link, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OverviewPanel } from "@/components/ui/OverviewPanel"

type Props = {
  companyId: string
  tokenHint: string | null
  isAdmin: boolean
}

const FEATURES = [
  {
    icon: KeyRound,
    title: "1. Generate a token",
    text: "It is shown once. Store it in your collector and send it as a bearer token.",
  },
  {
    icon: Link,
    title: "2. Point your collector at the feed",
    text: "Copy the endpoint below into Splunk, Microsoft Sentinel or any HTTPS collector.",
  },
  {
    icon: FileCode,
    title: "3. Pick a format",
    text: "Set format to cef, syslog or json. Add since to fetch only newer alerts.",
  },
]

function generateToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

export function SiemPullPanel({ companyId, tokenHint, isAdmin }: Props) {
  const [hint, setHint] = useState(tokenHint)
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
    }
  }

  return (
    <OverviewPanel
      title="Let your SIEM pull alerts"
      description="Your SIEM or SOAR calls Gardik on its own schedule and fetches new alerts over HTTPS."
      status={{ on: hint !== null, label: hint ? `Token ${hint}` : "No token" }}
      action={
        isAdmin && (
          <Button variant={hint ? "outline" : "default"} onClick={() => void rotate()} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {hint ? "Rotate token" : "Generate token"}
          </Button>
        )
      }
      features={FEATURES}
    >
      {token && (
        <p className="break-all rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
          Copy now, it will not be shown again: <span className="font-mono">{token}</span>
        </p>
      )}
      <div>
        <label htmlFor="siem-feed" className="mb-2 block text-sm font-medium text-foreground">
          Feed endpoint
        </label>
        <div className="flex items-center gap-2">
          <input
            id="siem-feed"
            readOnly
            value={feedUrl}
            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
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
    </OverviewPanel>
  )
}
