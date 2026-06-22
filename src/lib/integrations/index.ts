import { toCef } from "./cef"
import { toSyslog } from "./syslog"
import type { SiemAlert, SiemFormat } from "./types"

export type { SiemAlert, SiemFormat } from "./types"
export { toCef } from "./cef"
export { toSyslog } from "./syslog"

function toJsonRecord(a: SiemAlert) {
  return {
    id: a.id,
    severity: a.severity,
    status: a.status,
    message: a.message,
    employee: a.employeeEmail,
    breach: a.breachName,
    timestamp: a.createdAt.toISOString(),
  }
}

// Serialize a batch of alerts in the requested SIEM format. CEF and syslog are
// newline-delimited (one event per line); json is a single JSON array.
export function formatAlerts(alerts: SiemAlert[], format: SiemFormat): string {
  switch (format) {
    case "cef":
      return alerts.map(toCef).join("\n")
    case "syslog":
      return alerts.map((a) => toSyslog(a)).join("\n")
    case "json":
      return JSON.stringify(alerts.map(toJsonRecord))
  }
}

export const CONTENT_TYPE: Record<SiemFormat, string> = {
  cef: "text/plain; charset=utf-8",
  syslog: "text/plain; charset=utf-8",
  json: "application/json",
}
