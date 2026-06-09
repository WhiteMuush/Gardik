import type { BreachProvider, Finding } from "../types"

const API = "https://api.snusbase.com/data/search"

// Known fields returned by Snusbase, treated as exposed data.
const EXPOSABLE = ["email", "username", "password", "hash", "salt", "lastip"] as const

type SnusbaseResponse = { results?: Record<string, Record<string, unknown>[]> }

// Snusbase, email lookup. Results grouped by source database.
export const snusbase: BreachProvider = {
  id: "SNUSBASE",
  source: "DARK_WEB",
  async lookup(email, apiKey) {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Auth: apiKey },
      body: JSON.stringify({ terms: [email], types: ["email"] }),
    })
    if (!res.ok) throw new Error(`Snusbase error ${res.status}`)

    const data = (await res.json()) as SnusbaseResponse
    return Object.entries(data.results ?? {}).map(
      ([name, rows]): Finding => ({
        name,
        breachDate: new Date(0),
        dataTypes: EXPOSABLE.filter((f) => rows.some((row) => row[f])),
      })
    )
  },
}
