export const THEMES = ["system", "light", "dark"] as const
export const ACCENTS = ["violet", "blue", "teal", "rose", "orange"] as const
export const TEXT_SIZES = ["small", "default", "large"] as const
export const MOTIONS = ["system", "reduce", "full"] as const

export type Preferences = {
  theme: (typeof THEMES)[number]
  accent: (typeof ACCENTS)[number]
  textSize: (typeof TEXT_SIZES)[number]
  motion: (typeof MOTIONS)[number]
  colorblind: boolean
  readableFont: boolean
  timeZone: string | null
  homePage: string | null
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  accent: "violet",
  textSize: "default",
  motion: "system",
  colorblind: false,
  readableFont: false,
  timeZone: null,
  homePage: null,
}

const CHOICES: Record<string, readonly string[]> = {
  theme: THEMES,
  accent: ACCENTS,
  textSize: TEXT_SIZES,
  motion: MOTIONS,
}

export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value })
    return true
  } catch {
    return false
  }
}

// A local path only, so a saved home page can never send anyone to another site.
const isLocalPath = (value: string) => /^\/[a-z-]+(\/[a-z-]+)*$/.test(value)

function isValid(key: keyof Preferences, value: unknown): boolean {
  if (key in CHOICES) return typeof value === "string" && CHOICES[key]!.includes(value)
  if (key === "colorblind" || key === "readableFont") return typeof value === "boolean"
  if (value === null) return true
  if (typeof value !== "string") return false
  return key === "timeZone" ? isTimeZone(value) : isLocalPath(value)
}

const KEYS = Object.keys(DEFAULT_PREFERENCES) as (keyof Preferences)[]

export function parsePreferencesPatch(
  body: unknown
): { ok: true; patch: Partial<Preferences> } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Nothing to save" }
  const patch: Record<string, unknown> = {}
  for (const key of KEYS) {
    if (!(key in body)) continue
    const value = (body as Record<string, unknown>)[key]
    if (!isValid(key, value)) return { ok: false, error: `Invalid ${key}` }
    patch[key] = value
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: "Nothing to save" }
  return { ok: true, patch: patch as Partial<Preferences> }
}

// Stored rows may predate a removed choice, so each field falls back to its default on its own.
export function sanitizePreferences(stored: Record<string, unknown> | null): Preferences {
  const result = { ...DEFAULT_PREFERENCES } as Record<string, unknown>
  if (!stored) return result as Preferences
  for (const key of KEYS) {
    if (key in stored && isValid(key, stored[key])) result[key] = stored[key]
  }
  return result as Preferences
}
