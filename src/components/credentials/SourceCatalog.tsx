"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  API_PROVIDERS,
  recommendationLevel,
  type ProviderMeta,
  type RecommendationLevel,
} from "@/lib/credentials/providers"
import { sourceHealth, type SourceHealth } from "@/lib/credentials/health"
import type { SourceCoverage } from "@/lib/scan/coverage"
import { SourceDrawer } from "./SourceDrawer"
import { HealthPill, LevelBadge, SourceAvatar } from "./SourceBadges"

export type SourceCredential = {
  id: string
  provider: ProviderMeta["id"]
  keyHint: string
  rateLimitPerMinute: number | null
  lastUsedAt: string | null
  updatedAt: string
}

export type SourceView = {
  meta: ProviderMeta
  level: RecommendationLevel
  credential: SourceCredential | null
  coverage: SourceCoverage | null
  health: SourceHealth
  defaultRate: number
}

type Filter = "All" | "Connected" | "Needs action" | RecommendationLevel

const FILTERS: Filter[] = ["All", "Connected", "Needs action", "Recommended", "Additional", "Free or limited"]

type Props = {
  credentials: SourceCredential[]
  coverage: SourceCoverage[]
  defaultRates: Partial<Record<ProviderMeta["id"], number>>
  lastScanAt: string | null
  isAdmin: boolean
  canScan: boolean
}

function matches(view: SourceView, filter: Filter, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q && !`${view.meta.label} ${view.meta.description}`.toLowerCase().includes(q)) return false
  if (filter === "All") return true
  if (filter === "Connected") return view.credential !== null
  if (filter === "Needs action") return view.health.status === "NEEDS_ACTION"
  return view.level === filter
}

function formatScan(iso: string | null): string {
  if (!iso) return "Never"
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function SourceCatalog({ credentials, coverage, defaultRates, lastScanAt, isAdmin, canScan }: Props) {
  const [filter, setFilter] = useState<Filter>("All")
  const [query, setQuery] = useState("")
  const [openId, setOpenId] = useState<ProviderMeta["id"] | null>(null)

  const views: SourceView[] = useMemo(
    () =>
      [...API_PROVIDERS]
        .sort((a, b) => a.tier - b.tier)
        .map((meta) => {
          const credential = credentials.find((c) => c.provider === meta.id) ?? null
          const cov = coverage.find((c) => c.provider === meta.id) ?? null
          return {
            meta,
            level: recommendationLevel(meta.tier),
            credential,
            coverage: cov,
            health: sourceHealth(credential ? { updatedAt: new Date(credential.updatedAt) } : null, cov),
            defaultRate: defaultRates[meta.id] ?? 1,
          }
        }),
    [credentials, coverage, defaultRates]
  )

  const visible = views.filter((v) => matches(v, filter, query))
  const connected = views.filter((v) => v.credential).length
  const needsAction = views.filter((v) => v.health.status === "NEEDS_ACTION").length
  const open = views.find((v) => v.meta.id === openId) ?? null

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Connected sources</p>
          <p className="mt-1 text-xl font-semibold text-foreground">
            {connected} <span className="text-sm font-normal text-muted-foreground">of {views.length}</span>
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Last scan</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{formatScan(lastScanAt)}</p>
        </div>
        <button
          type="button"
          onClick={() => setFilter("Needs action")}
          disabled={needsAction === 0}
          className={cn(
            "rounded-xl border px-4 py-3 text-left transition-colors",
            needsAction > 0
              ? "border-destructive/40 bg-destructive/5 hover:bg-destructive/10"
              : "border-border/60 bg-card"
          )}
        >
          <p className="text-xs text-muted-foreground">Needs action</p>
          <p
            className={cn(
              "mt-1 text-xl font-semibold",
              needsAction > 0 ? "text-destructive" : "text-foreground"
            )}
          >
            {needsAction}
          </p>
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search sources..."
            aria-label="Search sources"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter sources">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                filter === f
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        Levels are advice only: enable any source, in any combination.
      </p>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">No source matches these filters.</p>
          <button
            type="button"
            onClick={() => {
              setFilter("All")
              setQuery("")
            }}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Show all sources
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((view) => (
            <button
              key={view.meta.id}
              type="button"
              onClick={() => setOpenId(view.meta.id)}
              className="group flex flex-col rounded-xl border border-border/60 bg-card p-4 text-left transition-all hover:border-primary/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start gap-3">
                <SourceAvatar initials={view.meta.initials} logo={view.meta.logo} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{view.meta.label}</p>
                  <LevelBadge level={view.level} className="mt-1" />
                </div>
              </div>
              <p className="mt-3 line-clamp-2 flex-1 text-xs text-muted-foreground">
                {view.meta.description}
              </p>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                <span className="text-xs text-foreground">
                  {view.meta.pricing.from ? `From ${view.meta.pricing.from}` : "Price not published"}
                </span>
                <HealthPill health={view.health} />
              </div>
            </button>
          ))}
        </div>
      )}

      <SourceDrawer source={open} isAdmin={isAdmin} canScan={canScan} onClose={() => setOpenId(null)} />
    </div>
  )
}
