import type { AlertConfidence, ApiProvider } from "@prisma/client"

// Tier 1 is curated, 2 structured aggregators, 3 noisy OSINT; the tier sets confidence, never severity.
export type ProviderTier = 1 | 2 | 3

// Published price at the last check, so the UI shows that date and links to the live page.
export interface ProviderPricing {
  from: string | null // cheapest plan with API access; null when not published
  freeTier: string | null
  note: string | null
  url: string
  checkedOn: string
}

// `wired` tells whether the code consumes the key today.
export interface ProviderMeta {
  id: ApiProvider
  label: string
  initials: string
  logo: string | null // the provider's own icon in public/sources, shown to identify it
  description: string
  docsUrl: string
  wired: boolean
  tier: ProviderTier
  pricing: ProviderPricing
}

const CHECKED_ON = "October 2026"

export const API_PROVIDERS: ProviderMeta[] = [
  {
    id: "HIBP",
    initials: "HB",
    logo: "/sources/hibp.png",
    label: "Have I Been Pwned",
    description: "Curated breach dumps, verified before they are published. Rare false positives.",
    docsUrl: "https://haveibeenpwned.com/API/Key",
    wired: true,
    tier: 1,
    pricing: {
      from: "$4.39/month",
      freeTier: null,
      note: "Entry plan allows 10 requests per minute.",
      url: "https://haveibeenpwned.com/Subscription",
      checkedOn: CHECKED_ON,
    },
  },
  {
    id: "HIBP_STEALER",
    initials: "SL",
    logo: "/sources/hibp.png",
    label: "Have I Been Pwned (Stealer Logs)",
    description:
      "Credentials captured by malware on an infected machine: the earliest warning, often before the data is sold.",
    docsUrl: "https://haveibeenpwned.com/API/Key",
    wired: true,
    tier: 1,
    pricing: {
      from: "$379/month",
      freeTier: null,
      note: "Pro plan. HIBP's pricing page is unclear on whether cheaper plans include stealer logs.",
      url: "https://haveibeenpwned.com/Subscription",
      checkedOn: CHECKED_ON,
    },
  },
  {
    id: "DEHASHED",
    initials: "DH",
    logo: "/sources/dehashed.png",
    label: "DeHashed",
    description: "Large search engine over leaked databases, including passwords and hashes.",
    docsUrl: "https://www.dehashed.com/",
    wired: true,
    tier: 2,
    pricing: {
      from: null,
      freeTier: null,
      note: "Subscription plus per-query API credits.",
      url: "https://dehashed.com/pricing",
      checkedOn: CHECKED_ON,
    },
  },
  {
    id: "LEAKCHECK",
    initials: "LC",
    logo: "/sources/leakcheck.png",
    label: "LeakCheck",
    description: "Wide breach coverage at a low price, with the leaked data types for each hit.",
    docsUrl: "https://leakcheck.io/",
    wired: true,
    tier: 2,
    pricing: {
      from: "$9.99/month",
      freeTier: null,
      note: "200 requests per day on the entry plan.",
      url: "https://leakcheck.io/pricing",
      checkedOn: CHECKED_ON,
    },
  },
  {
    id: "INTELX",
    initials: "IX",
    logo: "/sources/intelx.png",
    label: "Intelligence X",
    description: "Broad OSINT and dark web search. Many results, often without detail, so more noise.",
    docsUrl: "https://intelx.io/",
    wired: true,
    tier: 3,
    pricing: {
      from: "EUR 7,000/year",
      freeTier: "50 searches per day (fair use)",
      note: null,
      url: "https://intelx.io/product",
      checkedOn: CHECKED_ON,
    },
  },
  {
    id: "SNUSBASE",
    initials: "SB",
    logo: "/sources/snusbase.png",
    label: "Snusbase",
    description: "Indexed breach database with plaintext results for members.",
    docsUrl: "https://snusbase.com/",
    wired: true,
    tier: 2,
    pricing: {
      from: null,
      freeTier: null,
      note: "API included with paid membership.",
      url: "https://snusbase.com/",
      checkedOn: CHECKED_ON,
    },
  },
]

export type RecommendationLevel = "Recommended" | "Additional" | "Free or limited"

const LEVELS: Record<ProviderTier, RecommendationLevel> = {
  1: "Recommended",
  2: "Additional",
  3: "Free or limited",
}

// Advice only: every source can be enabled whatever its level.
export function recommendationLevel(tier: ProviderTier): RecommendationLevel {
  return LEVELS[tier]
}

export function providersByLevel(): { level: RecommendationLevel; providers: ProviderMeta[] }[] {
  return ([1, 2, 3] as const).map((tier) => ({
    level: LEVELS[tier],
    providers: API_PROVIDERS.filter((p) => p.tier === tier),
  }))
}

export function priceLabel(meta: ProviderMeta): string {
  const price = meta.pricing.from ? `From ${meta.pricing.from}` : "Price not published"
  return `${price}, checked ${meta.pricing.checkedOn}`
}

export const PROVIDER_IDS = new Set(API_PROVIDERS.map((p) => p.id))

export function providerMeta(id: ApiProvider): ProviderMeta | undefined {
  return API_PROVIDERS.find((p) => p.id === id)
}

// Tier 1 is trusted (HIGH), tier 2 MEDIUM, tier 3 noisy OSINT LOW.
const TIER_CONFIDENCE: Record<ProviderTier, AlertConfidence> = {
  1: "HIGH",
  2: "MEDIUM",
  3: "LOW",
}

// Unknown providers fall back to MEDIUM rather than over- or under-stating reliability.
export function confidenceForProvider(id: ApiProvider): AlertConfidence {
  const tier = providerMeta(id)?.tier ?? 2
  return TIER_CONFIDENCE[tier]
}
