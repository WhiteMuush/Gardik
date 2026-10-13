import type { BreachProvider } from "../types"
import { normalizeType, parseBreachDate } from "../normalize"
import { ProviderError, errorFromResponse } from "../errors"

const API = "https://leakcheck.io/api/v2/query"

type LeakCheckResult = {
  source?: { name?: string; breach_date?: string }
  fields?: string[]
}
type LeakCheckResponse = { success: boolean; result?: LeakCheckResult[] }

// LeakCheck API v2 Pro, email lookup.
export const leakcheck: BreachProvider = {
  id: "LEAKCHECK",
  source: "DARK_WEB",
  // Pro API: 3 requests per second (daily quotas are reported as failures).
  defaultRatePerMinute: 180,
  async lookup(email, apiKey) {
    const res = await fetch(`${API}/${encodeURIComponent(email)}`, {
      headers: { "X-API-Key": apiKey, Accept: "application/json" },
    })
    if (res.status === 404) return []
    // A malformed key (truncated on paste) comes back as 400, not 401.
    if (res.status === 400) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (/api-key/i.test(body.error ?? "")) throw new ProviderError("LeakCheck error 400", 401)
    }
    if (!res.ok) throw errorFromResponse("LeakCheck", res)

    const data = (await res.json()) as LeakCheckResponse
    if (!data.success || !data.result) return []

    return data.result.map((r) => ({
      name: r.source?.name ?? "Unknown (LeakCheck)",
      breachDate: parseBreachDate(r.source?.breach_date),
      dataTypes: (r.fields ?? []).map(normalizeType),
    }))
  },
}
