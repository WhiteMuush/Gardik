import type { Severity } from "@prisma/client"
import type { SiemAlert } from "./types"

// ArcSight CEF severity is 0-10. Map Gardik severities onto that scale.
const CEF_SEVERITY: Record<Severity, number> = { CRITICAL: 10, HIGH: 8, MEDIUM: 5, LOW: 2 }

// Escapes backslash and pipe, and turns a line break into a space so a source cannot forge an event.
function escapeHeader(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r\n|\r|\n/g, " ")
}

// CEF extension values escape backslash, equals and line breaks.
function escapeExt(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/=/g, "\\=").replace(/\n/g, "\\n").replace(/\r/g, "\\r")
}

// CEF:0|Vendor|Product|Version|SignatureID|Name|Severity|Extension, ingestible by Splunk and Sentinel.
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
    "Gardik",
    "Gardik",
    "1.0",
    "breach-exposure",
    escapeHeader(alert.message),
    String(CEF_SEVERITY[alert.severity]),
  ].join("|")

  return `${header}|${extension}`
}
