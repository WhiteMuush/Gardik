"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ExternalLink, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { PasswordInput } from "@/components/ui/password-input"
import { ScanButton } from "@/components/employees/ScanButton"
import { priceLabel } from "@/lib/credentials/providers"
import { remedyFor } from "@/lib/scan/remedies"
import { RemedyPanel } from "@/components/employees/RemedyPanel"
import type { SourceView } from "./SourceCatalog"
import { HealthPill, LevelBadge, SourceAvatar } from "./SourceBadges"

const LEVEL_WHY = {
  Recommended: "Reliable data with few false positives. Start here.",
  Additional: "Wider coverage, with more noise. Useful next to a recommended source.",
  "Free or limited": "Free or limited access to start, with less precise results.",
} as const

type Props = {
  source: SourceView | null
  isAdmin: boolean
  canScan: boolean
  onClose: () => void
}

const inputClass = cn(
  "h-8 rounded-md border border-border bg-background px-2.5 text-xs",
  "text-foreground outline-none focus:ring-1 focus:ring-ring"
)

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border p-5 last:border-b-0">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

export function SourceDrawer({ source, isAdmin, canScan, onClose }: Props) {
  useEffect(() => {
    if (!source) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [source, onClose])

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-foreground/10 backdrop-blur-sm transition-opacity duration-300",
          source ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />
      <aside
        aria-label={source ? `${source.meta.label} details` : undefined}
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-[480px] flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300",
          source ? "translate-x-0" : "translate-x-full"
        )}
      >
        {source && (
          <SourceDetails
            key={source.meta.id}
            source={source}
            isAdmin={isAdmin}
            canScan={canScan}
            onClose={onClose}
          />
        )}
      </aside>
    </>
  )
}

// Keyed by source in the drawer, so drafts and errors never leak from one
// source to the next.
function SourceDetails({ source, isAdmin, canScan, onClose }: Props & { source: SourceView }) {
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
  const remedy =
    source.health.status === "NEEDS_ACTION"
      ? remedyFor(source.meta.id, source.coverage?.lastFailureReason ?? null, "source")
      : null

  return (
    <>
      <div className="flex items-start gap-3 border-b border-border p-5">
        <SourceAvatar initials={source.meta.initials} logo={source.meta.logo} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{source.meta.label}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <LevelBadge level={source.level} />
            <HealthPill health={source.health} />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Section title="Overview">
          <p className="text-sm text-foreground">{source.meta.description}</p>
          <p className="mt-2 text-xs text-muted-foreground">{LEVEL_WHY[source.level]}</p>
        </Section>

        {cred && (
          <Section title="Health">
            <p className="text-sm text-foreground">{source.health.label}</p>
            {source.health.detail && source.health.status !== "NEEDS_ACTION" && (
              <p className="mt-1 text-xs text-muted-foreground">{source.health.detail}</p>
            )}
            {source.coverage && (
              <p className="mt-2 text-xs text-muted-foreground">
                {source.coverage.checked} checked - {source.coverage.failed} failed -{" "}
                {source.coverage.neverChecked} never checked
              </p>
            )}
            {remedy && (
              <div className="mt-3">
                <RemedyPanel remedy={remedy} />
              </div>
            )}
            {canScan && source.health.status !== "CONNECTED" && (
              <div className="mt-3">
                <ScanButton onlyIncomplete label="Scan unchecked" />
              </div>
            )}
          </Section>
        )}

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
              <Button size="sm" onClick={saveKey} disabled={pending || !keyDraft.trim()}>
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
                    onClick={() => setRate(Number(rateDraft))}
                    disabled={pending || !rateDraft.trim()}
                  >
                    Set rate
                  </Button>
                  {cred.rateLimitPerMinute !== null && (
                    <Button size="sm" variant="ghost" onClick={() => setRate(null)} disabled={pending}>
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
                  <Button size="sm" variant="destructive" onClick={removeKey} disabled={pending}>
                    Remove
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmRemove(false)}
                    disabled={pending}
                  >
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

        <Section title="Pricing">
          <p className="text-sm text-foreground">{priceLabel(source.meta)}</p>
          {source.meta.pricing.freeTier && (
            <p className="mt-1 text-xs text-muted-foreground">Free tier: {source.meta.pricing.freeTier}</p>
          )}
          {source.meta.pricing.note && (
            <p className="mt-1 text-xs text-muted-foreground">{source.meta.pricing.note}</p>
          )}
          <a
            href={source.meta.pricing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            See pricing <ExternalLink className="size-3" />
          </a>
        </Section>
      </div>
    </>
  )
}
