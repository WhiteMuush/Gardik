"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { API_PROVIDERS, recommendationLevel, type ProviderMeta } from "@/lib/credentials/providers"
import { sourceHealth } from "@/lib/credentials/health"
import type { SourceCoverage } from "@/lib/scan/coverage"
import { SourceDrawer } from "./SourceDrawer"
import { HealthPill, LevelBadge, SourceAvatar } from "./SourceBadges"
import { CatalogStats } from "./CatalogStats"
import { FILTERS, matches, type Filter, type SourceCredential, type SourceView } from "./source-view"

type Props = {
  credentials: SourceCredential[]
  coverage: SourceCoverage[]
  defaultRates: Partial<Record<ProviderMeta["id"], number>>
  lastScanAt: string | null
  isAdmin: boolean
  canScan: boolean
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
      <CatalogStats
        connected={connected}
        total={views.length}
        lastScanAt={lastScanAt}
        needsAction={needsAction}
        onNeedsAction={() => setFilter("Needs action")}
      />

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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
