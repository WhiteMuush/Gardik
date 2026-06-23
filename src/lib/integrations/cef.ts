import type { Severity } from "@prisma/client"
import type { SiemAlert } from "./types"

// ArcSight CEF severity is 0-10. Map DataShield severities onto that scale.
const CEF_SEVERITY: Record<Severity, number> = { CRITICAL: 10, HIGH: 8, MEDIUM: 5, LOW: 2 }

// CEF prefix fields (before the extension) escape backslash and pipe.
function escapeHeader(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|")
}

// CEF extension values escape backslash, equals and newlines.
function escapeExt(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/=/g, "\\=").replace(/\n/g, "\\n")
}

// Render one alert as a CEF line (Splunk / Microsoft Sentinel ingestible).
// CEF:0|Vendor|Product|Version|SignatureID|Name|Severity|Extension
export function toCef(alert: SiemAlert): string {
  const ext: Record<string, string> = {
    externalId: alert.id,
    cat: "breach-exposure",
    suser: alert.employeeEmail ?? "",
    cs1Label: "breach",
    cs1: alert.breachName ?? "",
    cs2Label: "status",
    cs2: alert.status,
    cs3Label: "confidence",
    cs3: alert.confidence,
    rt: String(alert.createdAt.getTime()),
  }
  const extension = Object.entries(ext)
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `${k}=${escapeExt(v)}`)
    .join(" ")

  const header = [
    "CEF:0",
    "DataShield",
    "DataShield",
    "1.0",
    "breach-exposure",
    escapeHeader(alert.message),
    String(CEF_SEVERITY[alert.severity]),
  ].join("|")

  return `${header}|${extension}`
}
