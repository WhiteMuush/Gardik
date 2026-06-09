import type { ApiProvider, BreachSource } from "@prisma/client"

// Normalized lookup result, shared across every provider.
export interface Finding {
  name: string // breach/source identifier (used as the Breach unique key)
  breachDate: Date // breach date; epoch (1970) when the provider does not expose it
  dataTypes: string[] // exposed data types, normalized to snake_case
}

// Contract every breach intelligence provider must implement.
export interface BreachProvider {
  id: ApiProvider
  source: BreachSource
  lookup(email: string, apiKey: string): Promise<Finding[]>
}
