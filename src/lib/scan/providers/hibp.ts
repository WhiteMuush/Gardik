import type { BreachProvider } from "../types"
import { normalizeType, parseBreachDate } from "../normalize"
import { errorFromResponse } from "../errors"

const API = "https://haveibeenpwned.com/api/v3/breachedaccount"

type HibpBreach = { Name: string; BreachDate: string; DataClasses: string[] }

// HIBP labels are plural, so the critical ones are mapped onto the keys severity and risk compare against.
const CANONICAL: Record<string, string> = {
  passwords: "password",
  credit_cards: "credit_card",
  bank_account_numbers: "bank_account",
  social_security_numbers: "ssn",
}

function dataType(label: string): string {
  const key = normalizeType(label)
  return CANONICAL[key] ?? key
}

// Have I Been Pwned, account (email) lookup.
export const hibp: BreachProvider = {
  id: "HIBP",
  source: "HIBP",
  // Core 1 plan: 10 requests per minute.
  defaultRatePerMinute: 10,
  async lookup(email, apiKey) {
    const res = await fetch(`${API}/${encodeURIComponent(email)}?truncateResponse=false`, {
      headers: { "hibp-api-key": apiKey, "user-agent": "Gardik" },
    })
    if (res.status === 404) return []
    if (!res.ok) throw errorFromResponse("HIBP", res)

    const breaches = (await res.json()) as HibpBreach[]
    return breaches.map((b) => ({
      name: b.Name,
      breachDate: parseBreachDate(b.BreachDate),
      dataTypes: b.DataClasses.map(dataType),
    }))
  },
}
