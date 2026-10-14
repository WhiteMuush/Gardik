import type { BreachProvider, Finding } from "../types"
import { errorFromResponse } from "../errors"

const API = "https://haveibeenpwned.com/api/v3/stealerlogsbyemail"

// HIBP stealer logs expose only the captured domains, so each one becomes a saved-password artifact.
export const hibpStealer: BreachProvider = {
  id: "HIBP_STEALER",
  source: "STEALER_LOG",
  // Same key family as HIBP, so the same Core 1 floor of 10 per minute.
  defaultRatePerMinute: 10,
  async lookup(email, apiKey) {
    const res = await fetch(`${API}/${encodeURIComponent(email)}`, {
      headers: { "hibp-api-key": apiKey, "user-agent": "Gardik" },
    })
    if (res.status === 404) return []
    if (!res.ok) throw errorFromResponse("HIBP stealer logs", res)

    const domains = (await res.json()) as string[]
    return domains.map((domain): Finding => ({
      name: `Stealer log: ${domain}`,
      breachDate: new Date(0),
      dataTypes: ["password"],
      artifacts: ["PASSWORD"],
    }))
  },
}
