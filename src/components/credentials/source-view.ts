import type { ProviderMeta, RecommendationLevel } from "@/lib/credentials/providers"
import type { SourceHealth } from "@/lib/credentials/health"
import type { SourceCoverage } from "@/lib/scan/coverage"

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

export type Filter = "All" | "Connected" | "Needs action" | RecommendationLevel

export const FILTERS: Filter[] = [
  "All",
  "Connected",
  "Needs action",
  "Recommended",
  "Additional",
  "Free or limited",
]

export function matches(view: SourceView, filter: Filter, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q && !`${view.meta.label} ${view.meta.description}`.toLowerCase().includes(q)) return false
  if (filter === "All") return true
  if (filter === "Connected") return view.credential !== null
  if (filter === "Needs action") return view.health.status === "NEEDS_ACTION"
  return view.level === filter
}
