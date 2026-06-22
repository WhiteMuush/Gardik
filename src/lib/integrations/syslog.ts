import type { Severity } from "@prisma/client"
import type { SiemAlert } from "./types"

// RFC 5424 severity (0-7, lower is worse). DataShield severities map onto the
// classic crit/err/warning/notice levels.
const SYSLOG_SEVERITY: Record<Severity, number> = { CRITICAL: 2, HIGH: 3, MEDIUM: 4, LOW: 5 }

// Facility 10 (security/authorization messages).
const FACILITY = 10
const APP_NAME = "datashield"

function sdValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/]/g, "\\]")
}

// Render one alert as an RFC 5424 syslog line.
// <PRI>1 TIMESTAMP HOSTNAME APP-NAME PROCID MSGID STRUCTURED-DATA MSG
export function toSyslog(alert: SiemAlert, hostname = "datashield"): string {
  const pri = FACILITY * 8 + SYSLOG_SEVERITY[alert.severity]
  const timestamp = alert.createdAt.toISOString()
  const sd =
    `[datashield@0 alertId="${sdValue(alert.id)}"` +
    ` severity="${alert.severity}" status="${alert.status}"` +
    ` employee="${sdValue(alert.employeeEmail ?? "")}"` +
    ` breach="${sdValue(alert.breachName ?? "")}"]`
  return `<${pri}>1 ${timestamp} ${hostname} ${APP_NAME} - breach-exposure ${sd} ${alert.message}`
}
