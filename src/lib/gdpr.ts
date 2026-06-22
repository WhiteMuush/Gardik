// GDPR Article 33 requires notifying the supervisory authority within 72 hours
// of becoming aware of a personal-data breach.
export const NOTIFICATION_DEADLINE_HOURS = 72
const HOUR_MS = 60 * 60 * 1000

// Map DataShield data-type keys onto GDPR data categories. Unknown types fall
// back to "other_personal_data" so nothing is silently dropped from the record.
const DATA_TYPE_TO_CATEGORY: Record<string, string> = {
  credit_card: "financial",
  bank_account: "financial",
  salary: "financial",
  tax_id: "national_identifier",
  ssn: "national_identifier",
  national_id: "national_identifier",
  passport: "national_identifier",
  health_records: "special_category",
  biometric_data: "special_category",
  password: "credentials",
  username: "credentials",
  email: "contact",
  phone: "contact",
  address: "contact",
  date_of_birth: "identity",
  ip_address: "online_identifier",
  geolocation: "online_identifier",
  contracts: "contractual",
}

export const GDPR_CATEGORY_LABELS: Record<string, string> = {
  financial: "Financial data",
  national_identifier: "National identifiers",
  special_category: "Special category (Art. 9)",
  credentials: "Authentication credentials",
  contact: "Contact details",
  identity: "Identity data",
  online_identifier: "Online identifiers",
  contractual: "Contractual data",
  other_personal_data: "Other personal data",
}

// Unique GDPR categories covered by a set of exposed data-type keys.
export function mapToGdprCategories(dataTypes: string[]): string[] {
  const set = new Set<string>()
  for (const t of dataTypes) set.add(DATA_TYPE_TO_CATEGORY[t.toLowerCase()] ?? "other_personal_data")
  return [...set].sort()
}

// True when any exposed type is a GDPR Article 9 special category, which raises
// the bar for notification.
export function hasSpecialCategory(dataTypes: string[]): boolean {
  return mapToGdprCategories(dataTypes).includes("special_category")
}

export function notificationDeadline(detectedAt: Date): Date {
  return new Date(detectedAt.getTime() + NOTIFICATION_DEADLINE_HOURS * HOUR_MS)
}

// Whole hours left before the 72h deadline; negative once it has passed.
export function hoursUntilDeadline(detectedAt: Date, now: Date = new Date()): number {
  return Math.floor((notificationDeadline(detectedAt).getTime() - now.getTime()) / HOUR_MS)
}

export function isNotificationOverdue(detectedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() > notificationDeadline(detectedAt).getTime()
}
