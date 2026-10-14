"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ExternalLink, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { PasswordInput } from "@/components/ui/password-input"
import type { SourceView } from "./source-view"
import { Section, inputClass } from "./DrawerSection"

// The key, the rate limit and removal, each saved through the credentials API then refreshed.
export function SourceConfiguration({ source, isAdmin }: { source: SourceView; isAdmin: boolean }) {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const [busy, setBusy] = useState(false)
  const [keyDraft, setKeyDraft] = useState("")
  const [rateDraft, setRateDraft] = useState("")
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function call(url: string, init: RequestInit, fallback: string): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(url, init)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? fallback)
        return false
      }
      startRefresh(() => router.refresh())
      return true
    } finally {
      setBusy(false)
    }
  }

  async function saveKey() {
    if (!keyDraft.trim()) return
    const ok = await call(
      "/api/credentials",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: source.meta.id, key: keyDraft.trim() }),
      },
      "Could not save the key"
    )
    if (ok) setKeyDraft("")
  }

  async function removeKey() {
    if (!source.credential) return
    const ok = await call(
      `/api/credentials/${source.credential.id}`,
      { method: "DELETE" },
      "Could not remove the key"
    )
    if (ok) setConfirmRemove(false)
  }

  async function setRate(value: number | null) {
    if (!source.credential) return
    const ok = await call(
      `/api/credentials/${source.credential.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rateLimitPerMinute: value }),
      },
      "Could not save the rate limit"
    )
    if (ok) setRateDraft("")
  }

  const pending = busy || refreshing
  const cred = source.credential

  return (
    <Section title="Configuration">
      {cred ? (
        <p className="text-xs text-muted-foreground">
          API key <span className="font-medium text-foreground">{cred.keyHint}</span>
          {cred.lastUsedAt &&
            `, last used ${new Date(cred.lastUsedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}`}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Not connected.
          <a
            href={source.meta.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 inline-flex items-center gap-1 text-primary hover:underline"
          >
            Get an API key <ExternalLink className="size-3" />
          </a>
        </p>
      )}

      {isAdmin ? (
        <div className="mt-3 flex items-center gap-2">
          <PasswordInput
            autoComplete="off"
            placeholder={cred ? "Replace key..." : "Paste API key..."}
            aria-label={`${source.meta.label} API key`}
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            className={cn(inputClass, "flex-1")}
          />
          <Button size="sm" onClick={() => void saveKey()} disabled={pending || !keyDraft.trim()}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : cred ? "Replace" : "Connect"}
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Only users who can manage API keys can change this source.
        </p>
      )}

      {cred && (
        <div className="mt-5">
          <p className="text-xs text-muted-foreground">
            Rate limit:{" "}
            <span className="font-medium text-foreground">
              {cred.rateLimitPerMinute ?? source.defaultRate} requests per minute
            </span>{" "}
            {cred.rateLimitPerMinute === null
              ? "(default, the lowest paid plan). Raise it to match your plan."
              : "(set for your plan)."}
          </p>
          {isAdmin && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={100000}
                step={1}
                placeholder={String(cred.rateLimitPerMinute ?? source.defaultRate)}
                aria-label={`${source.meta.label} requests per minute`}
                value={rateDraft}
                onChange={(e) => setRateDraft(e.target.value)}
                className={cn(inputClass, "w-32")}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => void setRate(Number(rateDraft))}
                disabled={pending || !rateDraft.trim()}
              >
                Set rate
              </Button>
              {cred.rateLimitPerMinute !== null && (
                <Button size="sm" variant="ghost" onClick={() => void setRate(null)} disabled={pending}>
                  Use default
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {cred && isAdmin && (
        <div className="mt-5">
          {confirmRemove ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <p className="flex-1 text-xs text-foreground">
                Remove this key? Scans stop using {source.meta.label}.
              </p>
              <Button size="sm" variant="destructive" onClick={() => void removeKey()} disabled={pending}>
                Remove
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)} disabled={pending}>
                Cancel
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              className="text-xs text-destructive hover:underline"
            >
              Remove key
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </Section>
  )
}
