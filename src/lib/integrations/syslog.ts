import type { Severity } from "@prisma/client"
import type { SiemAlert } from "./types"

// RFC 5424 severity (lower is worse), mapped onto crit, err, warning and notice.
const SYSLOG_SEVERITY: Record<Severity, number> = { CRITICAL: 2, HIGH: 3, MEDIUM: 4, LOW: 5 }

// Facility 10 (security/authorization messages).
const FACILITY = 10
const APP_NAME = "gardik"

// One event per line: a line break from a breach source would forge a new one.
function oneLine(value: string): string {
  return value.replace(/\r\n|\r|\n/g, " ")
}

function sdValue(value: string): string {
  return oneLine(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/]/g, "\\]")
}

// RFC 5424 line: <PRI>1 TIMESTAMP HOSTNAME APP-NAME PROCID MSGID STRUCTURED-DATA MSG.
export function toSyslog(alert: SiemAlert, hostname = "gardik"): string {
  const pri = FACILITY * 8 + SYSLOG_SEVERITY[alert.severity]
  const timestamp = alert.createdAt.toISOString()
  const sd =
    `[gardik@0 alertId="${sdValue(alert.id)}"` +
    ` severity="${alert.severity}" confidence="${alert.confidence}" status="${alert.status}"` +
    ` employee="${sdValue(alert.employeeEmail ?? "")}"` +
    ` breach="${sdValue(alert.breachName ?? "")}"]`
  return `<${pri}>1 ${timestamp} ${hostname} ${APP_NAME} - breach-exposure ${sd} ${oneLine(alert.message)}`
}
