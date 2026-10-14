import type { Severity, AlertStatus, AlertConfidence } from "@prisma/client"

// Field names stay stable, since SIEM parsers key off them.
export type SiemAlert = {
  id: string
  severity: Severity
  confidence: AlertConfidence
  status: AlertStatus
  message: string
  employeeEmail: string | null
  breachName: string | null
  createdAt: Date
}

export type SiemFormat = "cef" | "syslog" | "json"
