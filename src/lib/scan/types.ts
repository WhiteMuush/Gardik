import type { ApiProvider, ArtifactKind, BreachSource } from "@prisma/client"

// Normalized lookup result, shared across every provider.
export interface Finding {
  name: string // breach/source identifier (used as the Breach unique key)
  breachDate: Date // breach date; epoch (1970) when the provider does not expose it
  dataTypes: string[] // exposed data types, normalized to snake_case
  artifacts?: ArtifactKind[] // stolen artifact kinds (stealer logs); empty for breach dumps
  machineId?: string // infected machine identifier, when the feed exposes it
  malwareFamily?: string // stealer family (e.g. RedLine, Lumma), when known
  capturedAt?: Date // when the log was captured off the endpoint, when known
}

// Contract every breach intelligence provider must implement.
export interface BreachProvider {
  id: ApiProvider
  source: BreachSource
  // Requests per minute allowed by the lowest paid plan that grants API
  // access; the customer can raise it per credential to match their plan.
  defaultRatePerMinute: number
  lookup(email: string, apiKey: string): Promise<Finding[]>
}
