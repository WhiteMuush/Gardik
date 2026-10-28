"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SettingRow } from "./SettingRow"

type Props = {
  pushHint: string | null
  pushFormat: string | null
  isAdmin: boolean
}

export function SiemPushRow({ pushHint: initialHint, pushFormat, isAdmin }: Props) {
  const [hint, setHint] = useState(initialHint)
  const [url, setUrl] = useState("")
  const [format, setFormat] = useState(pushFormat ?? "cef")
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  async function patch(siemPush: { url: string; format: string } | null) {
    setBusy(true)
    const res = await fetch("/api/company", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siemPush }),
    })
    setBusy(false)
    return res.ok
  }

  async function save() {
    if (await patch({ url, format })) {
      setHint(new URL(url).host)
      setUrl("")
      setOpen(false)
    }
  }

  async function remove() {
    if (await patch(null)) setHint(null)
  }

  const action = !isAdmin ? null : hint ? (
    <Button size="sm" variant="outline" onClick={() => void remove()} disabled={busy}>
      {busy && <Loader2 className="animate-spin" />}
      Remove
    </Button>
  ) : (
    <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={open}>
      Configure
    </Button>
  )

  return (
    <SettingRow
      title="SIEM push delivery"
      description="Gardik sends new alerts to your HTTPS collector on each scheduler run."
      status={{ on: hint !== null, label: hint ? `${format.toUpperCase()} to ${hint}` : "Not set" }}
      action={action}
      open={open}
      onToggle={() => setOpen(!open)}
    >
      <p className="text-xs text-muted-foreground">
        Works with Splunk HEC, Microsoft Sentinel or any HTTPS endpoint. Raw UDP or TCP syslog sockets are not
        supported.
      </p>
      {isAdmin && !hint && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Push format"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground focus:border-ring focus:outline-none"
          >
            <option value="cef">CEF</option>
            <option value="syslog">Syslog</option>
          </select>
          <input
            aria-label="Collector URL"
            placeholder="https://collector.example.com/ingest"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
          />
          <Button onClick={() => void save()} disabled={busy || !url.trim()}>
            {busy && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </div>
      )}
    </SettingRow>
  )
}
