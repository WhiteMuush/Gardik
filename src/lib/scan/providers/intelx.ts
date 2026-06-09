import type { BreachProvider, Finding } from "../types"
import { parseBreachDate, sleep } from "../normalize"

const ROOT = "https://2.intelx.io"
const MAX_POLLS = 6

type SearchInit = { id?: string; status?: number }
type IntelxRecord = { name?: string; date?: string; bucket?: string }
type ResultPage = { records?: IntelxRecord[]; status?: number }

// Lance une recherche IntelX et renvoie l'identifiant de recherche, ou null.
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

// Poll les résultats. status: 0 = résultats dispo, 1 = terminé, 2 = introuvable, 3 = patienter.
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

// Déduplique les enregistrements par bucket/nom en un Finding par source.
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

// Intelligence X, moteur de recherche OSINT/leaks (recherche asynchrone).
export const intelx: BreachProvider = {
  id: "INTELX",
  source: "DARK_WEB",
  async lookup(email, apiKey) {
    const id = await startSearch(email, apiKey)
    if (!id) return []
    return toFindings(await collectResults(id, apiKey))
  },
}
