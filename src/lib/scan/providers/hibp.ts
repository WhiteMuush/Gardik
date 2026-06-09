import type { BreachProvider } from "../types"
import { normalizeType, parseBreachDate } from "../normalize"

const API = "https://haveibeenpwned.com/api/v3/breachedaccount"

type HibpBreach = { Name: string; BreachDate: string; DataClasses: string[] }

// Have I Been Pwned, account (email) lookup.
export const hibp: BreachProvider = {
  id: "HIBP",
  source: "HIBP",
  async lookup(email, apiKey) {
    const res = await fetch(`${API}/${encodeURIComponent(email)}?truncateResponse=false`, {
      headers: { "hibp-api-key": apiKey, "user-agent": "DataShield" },
    })
    if (res.status === 404) return []
    if (!res.ok) throw new Error(`HIBP error ${res.status}`)

    const breaches = (await res.json()) as HibpBreach[]
    return breaches.map((b) => ({
      name: b.Name,
      breachDate: parseBreachDate(b.BreachDate),
      dataTypes: b.DataClasses.map(normalizeType),
    }))
  },
}
