import type { Severity, AlertStatus, AlertConfidence } from "@prisma/client"

// Minimal alert shape consumed by the SIEM formatters. Field mapping is kept
// stable on purpose: SIEM parsers key off these names.
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
