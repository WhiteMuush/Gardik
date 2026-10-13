import type { AlertConfidence, ArtifactKind, BreachSource, Severity } from "@prisma/client"

const CRITICAL_TYPES = ["password", "hashed_password", "credit_card", "ssn", "bank_account"]

export function severityFor(
  dataTypes: string[],
  artifacts: ArtifactKind[] = [],
  source: BreachSource = "MANUAL"
): Severity {
  // A live session cookie or token bypasses MFA, so it is CRITICAL whatever else leaked.
  if (artifacts.includes("COOKIE") || artifacts.includes("TOKEN")) return "CRITICAL"

  const critical = dataTypes.filter((d) => CRITICAL_TYPES.includes(d)).length

  // A stealer log proves the machine is infected right now, so it never rates below HIGH.
  if (source === "STEALER_LOG") {
    return critical >= 1 || artifacts.includes("PASSWORD") ? "CRITICAL" : "HIGH"
  }

  // Bare dark-web presence stays MEDIUM to avoid flooding HIGH alerts; every other source uses data types.
  if (critical >= 2) return "CRITICAL"
  if (critical === 1) return "HIGH"
  return "MEDIUM"
}

export const SEVERITY_RANK: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
const CONFIDENCE_ORDER: AlertConfidence[] = ["LOW", "MEDIUM", "HIGH"]

export function moreSevere(a: Severity, b: Severity): Severity {
  return SEVERITY_RANK[a] <= SEVERITY_RANK[b] ? a : b
}

export function moreConfident(a: AlertConfidence, b: AlertConfidence): AlertConfidence {
  return CONFIDENCE_ORDER.indexOf(a) >= CONFIDENCE_ORDER.indexOf(b) ? a : b
}

export function bumpConfidence(c: AlertConfidence): AlertConfidence {
  return CONFIDENCE_ORDER[Math.min(CONFIDENCE_ORDER.indexOf(c) + 1, CONFIDENCE_ORDER.length - 1)]
}
