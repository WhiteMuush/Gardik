import type { ApiProvider } from "@prisma/client"

// A record belongs to the providers that reported it; untagged legacy records only show in the unfiltered view.
export type BreachRecordRaw = { detectedAt: Date; exposedData: string[]; sources: ApiProvider[] }
export type BreachCatalogEntry = {
  id: string
  name: string
  source: string
  breachDate: Date
  dataTypes: string[]
  records: { employeeId: string; sources: ApiProvider[] }[]
}

export function matchesProvider(sources: ApiProvider[], provider?: ApiProvider): boolean {
  return !provider || sources.includes(provider)
}

export function buildTrendData(records: BreachRecordRaw[], provider?: ApiProvider) {
  const months: Record<string, number> = {}

  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = d.toLocaleString("en-US", { month: "short", year: "2-digit" })
    months[key] = 0
  }

  records.forEach(({ detectedAt, sources }) => {
    if (!matchesProvider(sources, provider)) return
    const key = new Date(detectedAt).toLocaleString("en-US", { month: "short", year: "2-digit" })
    if (key in months) months[key]++
  })

  return Object.entries(months).map(([month, count]) => ({ month, count }))
}

// Breaches affecting the company, optionally scoped to a single provider: a
// breach only appears when at least one of its records was reported by that
// provider, and the affected-employee count is computed over matching records.
export function buildBreachSources(catalog: BreachCatalogEntry[], provider?: ApiProvider) {
  return catalog
    .map((b) => ({
      entry: b,
      employees: new Set(
        b.records.filter((r) => matchesProvider(r.sources, provider)).map((r) => r.employeeId)
      ),
    }))
    .filter((x) => x.employees.size > 0)
    .map(({ entry, employees }) => ({
      id: entry.id,
      name: entry.name,
      source: entry.source,
      breachDate: entry.breachDate.toISOString(),
      dataTypes: entry.dataTypes,
      affectedEmployees: employees.size,
    }))
}

export function buildDataTypes(records: BreachRecordRaw[], provider?: ApiProvider) {
  const counts: Record<string, number> = {}
  const matching = records.filter((r) => matchesProvider(r.sources, provider))
  const total = matching.reduce((sum, r) => sum + r.exposedData.length, 0)

  matching.forEach(({ exposedData }) => {
    exposedData.forEach((type) => {
      counts[type] = (counts[type] || 0) + 1
    })
  })

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([type, count]) => ({
      type,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
}
