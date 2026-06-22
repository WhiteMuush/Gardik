import type { BreachProvider, Finding } from "../types"

const API = "https://haveibeenpwned.com/api/v3/stealerlogsbyemail"

// Have I Been Pwned stealer logs, email lookup. Returns the list of website
// domains for which this address had credentials captured by an infostealer.
// HIBP exposes only the domains: the artifact is a browser-saved password, and
// infection metadata (machine id, malware family, capture time) is not provided.
export const hibpStealer: BreachProvider = {
  id: "HIBP_STEALER",
  source: "STEALER_LOG",
  async lookup(email, apiKey) {
    const res = await fetch(`${API}/${encodeURIComponent(email)}`, {
      headers: { "hibp-api-key": apiKey, "user-agent": "DataShield" },
    })
    if (res.status === 404) return []
    if (!res.ok) throw new Error(`HIBP stealer logs error ${res.status}`)

    const domains = (await res.json()) as string[]
    return domains.map(
      (domain): Finding => ({
        name: `Stealer log: ${domain}`,
        breachDate: new Date(0),
        dataTypes: ["password"],
        artifacts: ["PASSWORD"],
      })
    )
  },
}
