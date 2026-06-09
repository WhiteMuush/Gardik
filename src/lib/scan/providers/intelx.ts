import type { BreachProvider, Finding } from "../types"
import { parseBreachDate, sleep } from "../normalize"

const ROOT = "https://2.intelx.io"
const MAX_POLLS = 6

type SearchInit = { id?: string; status?: number }
type IntelxRecord = { name?: string; date?: string; bucket?: string }
type ResultPage = { records?: IntelxRecord[]; status?: number }

// Start an IntelX search and return the search id, or null when nothing matches.
async function startSearch(email: string, apiKey: string): Promise<string | null> {
  const res = await fetch(`${ROOT}/intelligent/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Key": apiKey },
    body: JSON.stringify({
      term: email,
      lookuplevel: 0,
      maxresults: 100,
      timeout: 5,
      sort: 4,
      media: 0,
      terminate: [],
      buckets: [],
    }),
  })
  if (!res.ok) throw new Error(`IntelX error ${res.status}`)
  const data = (await res.json()) as SearchInit
  return data.status === 2 || !data.id ? null : data.id
}

// Poll results. status: 0 = results available, 1 = done, 2 = not found, 3 = keep trying.
async function collectResults(id: string, apiKey: string): Promise<IntelxRecord[]> {
  const url = `${ROOT}/intelligent/search/result?id=${encodeURIComponent(id)}&limit=100`
  const records: IntelxRecord[] = []
  for (let i = 0; i < MAX_POLLS; i++) {
    const res = await fetch(url, { headers: { "X-Key": apiKey } })
    if (!res.ok) break
    const page = (await res.json()) as ResultPage
    if (page.records?.length) records.push(...page.records)
    if (page.status === 1 || page.status === 2) break
    if (page.status === 3) await sleep(1000)
  }
  return records
}

// Deduplicate records by bucket/name into one Finding per source.
function toFindings(records: IntelxRecord[]): Finding[] {
  const byName = new Map<string, Finding>()
  for (const r of records) {
    const name = r.bucket || r.name || "Intelligence X"
    if (!byName.has(name)) {
      byName.set(name, { name, breachDate: parseBreachDate(r.date), dataTypes: [] })
    }
  }
  return [...byName.values()]
}

// Intelligence X, OSINT/leaks search engine (asynchronous search).
export const intelx: BreachProvider = {
  id: "INTELX",
  source: "DARK_WEB",
  async lookup(email, apiKey) {
    const id = await startSearch(email, apiKey)
    if (!id) return []
    return toFindings(await collectResults(id, apiKey))
  },
}
