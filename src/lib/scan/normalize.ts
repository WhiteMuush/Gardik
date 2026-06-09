// Normalise un libellé de type de donnée en snake_case minuscule.
export function normalizeType(raw: string): string {
  return raw.toLowerCase().trim().replace(/\s+/g, "_")
}

// Parse une date de fuite ; renvoie epoch (1970) quand elle est absente ou invalide.
export function parseBreachDate(raw?: string | null): Date {
  if (!raw) return new Date(0)
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? new Date(0) : d
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
