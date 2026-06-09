import type { BreachProvider, Finding } from "../types"

const API = "https://api.dehashed.com/v2/search"

// Fields that may be exposed within a DeHashed entry.
const EXPOSABLE = [
  "email",
  "username",
  "password",
  "hashed_password",
  "name",
  "address",
  "phone",
  "ip_address",
  "vin",
] as const

type DeHashedEntry = Record<string, unknown> & { database_name?: string }
type DeHashedResponse = { entries?: DeHashedEntry[] | null }

// DeHashed v2, exact email lookup. Entries carry no breach date, so we group by
// source database and infer which exposable fields are present.
export const dehashed: BreachProvider = {
  id: "DEHASHED",
  source: "DARK_WEB",
  async lookup(email, apiKey) {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "DeHashed-Api-Key": apiKey },
      body: JSON.stringify({ query: `email:"${email}"`, page: 1, size: 100 }),
    })
    if (!res.ok) throw new Error(`DeHashed error ${res.status}`)

    const data = (await res.json()) as DeHashedResponse
    const bySource = new Map<string, Set<string>>()

    for (const entry of data.entries ?? []) {
      const name = entry.database_name || "Unknown (DeHashed)"
      const fields = bySource.get(name) ?? new Set<string>()
      for (const f of EXPOSABLE) if (entry[f]) fields.add(f)
      bySource.set(name, fields)
    }

    return [...bySource].map(
      ([name, fields]): Finding => ({
        name,
        breachDate: new Date(0),
        dataTypes: [...fields],
      })
    )
  },
}
