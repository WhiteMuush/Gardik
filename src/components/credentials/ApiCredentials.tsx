"use client"

import { useState } from "react"
import { KeyRound, Trash2, Loader2, ExternalLink, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { API_PROVIDERS } from "@/lib/credentials/providers"

type ApiProvider = "HIBP" | "HIBP_STEALER" | "DEHASHED" | "LEAKCHECK" | "INTELX" | "SNUSBASE"

export type Credential = {
  id: string
  provider: ApiProvider
  keyHint: string
  lastUsedAt: string | null
}

type Props = {
  initial: Credential[]
  isAdmin: boolean
}

export function ApiCredentials({ initial, isAdmin }: Props) {
  const [creds, setCreds] = useState<Record<string, Credential>>(
    Object.fromEntries(initial.map((c) => [c.provider, c]))
  )
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  async function handleSave(provider: ApiProvider) {
    const key = drafts[provider]?.trim()
    if (!key) return
    setBusy(provider)
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, key }),
      })
      if (!res.ok) return
      const cred = (await res.json()) as Credential
      setCreds((prev) => ({ ...prev, [provider]: cred }))
      setDrafts((prev) => ({ ...prev, [provider]: "" }))
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete(provider: ApiProvider) {
    const cred = creds[provider]
    if (!cred) return
    setBusy(provider)
    try {
      const res = await fetch(`/api/credentials/${cred.id}`, { method: "DELETE" })
      if (!res.ok && res.status !== 204) return
      setCreds((prev) => {
        const next = { ...prev }
        delete next[provider]
        return next
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Breach API keys</h3>
        <p className="text-xs text-muted-foreground">
          Stored encrypted (AES-256-GCM). Keys are never displayed again after saving.
        </p>
      </div>

      <div className="space-y-3">
        {API_PROVIDERS.map((meta) => {
          const cred = creds[meta.id]
          const isBusy = busy === meta.id

          return (
            <div
              key={meta.id}
              className="flex items-start gap-4 rounded-xl border border-border/60 bg-card px-4 py-4"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <KeyRound className="size-4" />
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{meta.label}</p>
                  {cred ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                      <Check className="size-3" /> {cred.keyHint}
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Not configured
                    </span>
                  )}
                  {!meta.wired && (
                    <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-600 dark:text-yellow-400">
                      Coming soon
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
                <a
                  href={meta.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Get an API key <ExternalLink className="size-3" />
                </a>

                {isAdmin && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="password"
                      autoComplete="off"
                      placeholder={cred ? "Replace key…" : "Paste API key…"}
                      value={drafts[meta.id] ?? ""}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [meta.id]: e.target.value }))
                      }
                      className={cn(
                        "h-8 flex-1 rounded-md border border-border bg-background px-2.5 text-xs",
                        "text-foreground outline-none focus:ring-1 focus:ring-ring"
                      )}
                    />
                    <Button
                      size="sm"
                      onClick={() => handleSave(meta.id)}
                      disabled={isBusy || !drafts[meta.id]?.trim()}
                    >
                      {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
                    </Button>
                    {cred && (
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDelete(meta.id)}
                        disabled={isBusy}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
