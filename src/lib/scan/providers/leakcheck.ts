import type { BreachProvider } from "../types"
import { normalizeType, parseBreachDate } from "../normalize"

const API = "https://leakcheck.io/api/v2/query"

type LeakCheckResult = {
  source?: { name?: string; breach_date?: string }
  fields?: string[]
}
type LeakCheckResponse = { success: boolean; result?: LeakCheckResult[] }

// LeakCheck API v2 Pro, recherche par email.
export const leakcheck: BreachProvider = {
  id: "LEAKCHECK",
  source: "DARK_WEB",
  async lookup(email, apiKey) {
    const res = await fetch(`${API}/${encodeURIComponent(email)}`, {
      headers: { "X-API-Key": apiKey, Accept: "application/json" },
    })
    if (res.status === 404) return []
    if (!res.ok) throw new Error(`LeakCheck error ${res.status}`)

    const data = (await res.json()) as LeakCheckResponse
    if (!data.success || !data.result) return []

    return data.result.map((r) => ({
      name: r.source?.name ?? "Unknown (LeakCheck)",
      breachDate: parseBreachDate(r.source?.breach_date),
      dataTypes: (r.fields ?? []).map(normalizeType),
    }))
  },
}
