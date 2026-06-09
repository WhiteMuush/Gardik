import type { ApiProvider } from "@prisma/client"

// Metadata for the breach/leak intelligence API providers.
// `wired` indicates whether the code actually consumes the key today.
export interface ProviderMeta {
  id: ApiProvider
  label: string
  description: string
  docsUrl: string
  wired: boolean
}

export const API_PROVIDERS: ProviderMeta[] = [
  {
    id: "HIBP",
    label: "Have I Been Pwned",
    description: "Breach lookup by email or domain.",
    docsUrl: "https://haveibeenpwned.com/API/Key",
    wired: true,
  },
  {
    id: "DEHASHED",
    label: "DeHashed",
    description: "Search engine for compromised data.",
    docsUrl: "https://www.dehashed.com/",
    wired: true,
  },
  {
    id: "LEAKCHECK",
    label: "LeakCheck",
    description: "Data breach verification API.",
    docsUrl: "https://leakcheck.io/",
    wired: true,
  },
  {
    id: "INTELX",
    label: "Intelligence X",
    description: "OSINT, leaks and dark web search.",
    docsUrl: "https://intelx.io/",
    wired: true,
  },
  {
    id: "SNUSBASE",
    label: "Snusbase",
    description: "Indexed breach database.",
    docsUrl: "https://snusbase.com/",
    wired: true,
  },
]

export const PROVIDER_IDS = new Set(API_PROVIDERS.map((p) => p.id))

export function providerMeta(id: ApiProvider): ProviderMeta | undefined {
  return API_PROVIDERS.find((p) => p.id === id)
}
