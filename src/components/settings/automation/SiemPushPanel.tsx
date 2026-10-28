"use client"

import { useState } from "react"
import { FileText, Loader2, RefreshCw, Server } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AutomationPanel } from "./AutomationPanel"

type Props = {
  pushHint: string | null
  pushFormat: string | null
  isAdmin: boolean
}

const FEATURES = [
  {
    icon: Server,
    title: "Any HTTPS collector",
    text: "Splunk HEC, Microsoft Sentinel or a generic endpoint. Raw UDP or TCP syslog is not supported.",
  },
  {
    icon: FileText,
    title: "CEF or Syslog",
    text: "Choose the format your collector expects.",
  },
  {
    icon: RefreshCw,
    title: "Retried until delivered",
    text: "A failed delivery is sent again on the next scheduler run, with no gap and no duplicate.",
  },
]

export function SiemPushPanel({ pushHint: initialHint, pushFormat, isAdmin }: Props) {
  const [hint, setHint] = useState(initialHint)
  const [url, setUrl] = useState("")
  const [format, setFormat] = useState(pushFormat ?? "cef")
  const [busy, setBusy] = useState(false)

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
    }
  }

  async function remove() {
    if (await patch(null)) setHint(null)
  }

  return (
    <AutomationPanel
      title="Push alerts to your collector"
      description="Gardik sends every new alert to your HTTPS collector on each scheduler run, so nothing has to poll."
      status={{ on: hint !== null, label: hint ? `${format.toUpperCase()} to ${hint}` : "Not set" }}
      action={
        isAdmin &&
        hint && (
          <Button variant="outline" onClick={() => void remove()} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            Remove collector
          </Button>
        )
      }
      features={FEATURES}
    >
      {isAdmin && !hint && (
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Collector</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Push format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground focus:border-ring focus:outline-none"
            >
              <option value="cef">CEF</option>
              <option value="syslog">Syslog</option>
            </select>
            <input
              aria-label="Collector URL"
              placeholder="https://collector.example.com/ingest"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
            />
            <Button onClick={() => void save()} disabled={busy || !url.trim()}>
              {busy && <Loader2 className="animate-spin" />}
              Save collector
            </Button>
          </div>
        </div>
      )}
    </AutomationPanel>
  )
}
