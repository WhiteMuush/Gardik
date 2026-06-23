import type { AlertConfidence, ApiProvider } from "@prisma/client"

// Confidence tier of a breach intelligence provider, from most to least
// reliable. Tier 1 sources are curated and verified (rare false positives);
// tier 2 are structured aggregators; tier 3 are broad OSINT feeds that are
// noisier and often return no structured data. The tier feeds alert confidence,
// it never lowers severity on its own (a real exposure stays severe whoever
// reported it).
export type ProviderTier = 1 | 2 | 3

// Metadata for the breach/leak intelligence API providers.
// `wired` indicates whether the code actually consumes the key today.
export interface ProviderMeta {
  id: ApiProvider
  label: string
  description: string
  docsUrl: string
  wired: boolean
  tier: ProviderTier
}

export const API_PROVIDERS: ProviderMeta[] = [
  {
    id: "HIBP",
    label: "Have I Been Pwned",
    description: "Breach lookup by email or domain.",
    docsUrl: "https://haveibeenpwned.com/API/Key",
    wired: true,
    tier: 1,
  },
  {
    id: "HIBP_STEALER",
    label: "Have I Been Pwned (Stealer Logs)",
    description: "Infostealer-log exposure by email. Uses a Pwned 5 key.",
    docsUrl: "https://haveibeenpwned.com/API/Key",
    wired: true,
    tier: 1,
  },
  {
    id: "DEHASHED",
    label: "DeHashed",
    description: "Search engine for compromised data.",
    docsUrl: "https://www.dehashed.com/",
    wired: true,
    tier: 2,
  },
  {
    id: "LEAKCHECK",
    label: "LeakCheck",
    description: "Data breach verification API.",
    docsUrl: "https://leakcheck.io/",
    wired: true,
    tier: 2,
  },
  {
    id: "INTELX",
    label: "Intelligence X",
    description: "OSINT, leaks and dark web search.",
    docsUrl: "https://intelx.io/",
    wired: true,
    tier: 3,
  },
  {
    id: "SNUSBASE",
    label: "Snusbase",
    description: "Indexed breach database.",
    docsUrl: "https://snusbase.com/",
    wired: true,
    tier: 2,
  },
]

export const PROVIDER_IDS = new Set(API_PROVIDERS.map((p) => p.id))

export function providerMeta(id: ApiProvider): ProviderMeta | undefined {
  return API_PROVIDERS.find((p) => p.id === id)
}

// Base alert confidence implied by a provider tier. Tier 1 sources are trusted
// (HIGH), tier 2 structured aggregators (MEDIUM), tier 3 noisy OSINT (LOW).
const TIER_CONFIDENCE: Record<ProviderTier, AlertConfidence> = {
  1: "HIGH",
  2: "MEDIUM",
  3: "LOW",
}

// Confidence to stamp on an alert raised from a given provider. Unknown
// providers fall back to MEDIUM rather than over- or under-stating reliability.
export function confidenceForProvider(id: ApiProvider): AlertConfidence {
  const tier = providerMeta(id)?.tier ?? 2
  return TIER_CONFIDENCE[tier]
}
