import type { ApiProvider, BreachSource } from "@prisma/client"

// Résultat normalisé d'une recherche, commun à tous les providers.
export interface Finding {
  name: string // identifiant de la fuite/source (sert de clé unique du Breach)
  breachDate: Date // date de la fuite ; epoch (1970) si inconnue côté provider
  dataTypes: string[] // types de données exposées, normalisés en snake_case
}

// Contrat que chaque provider de breach intelligence doit implémenter.
export interface BreachProvider {
  id: ApiProvider
  source: BreachSource
  lookup(email: string, apiKey: string): Promise<Finding[]>
}
