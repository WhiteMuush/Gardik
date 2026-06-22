import { prisma } from "@/lib/prisma"
import {
  GDPR_CATEGORY_LABELS,
  hoursUntilDeadline,
  isNotificationOverdue,
  notificationDeadline,
} from "@/lib/gdpr"
import type { RegisterStatus } from "@prisma/client"

export type RegisterRow = {
  id: string
  title: string
  detectedAt: string
  status: RegisterStatus
  affectedCount: number
  dataCategories: string[]
  categoryLabels: string[]
  assessment: string | null
  notifiedAt: string | null
  deadline: string
  hoursRemaining: number
  overdue: boolean
}

type Entry = {
  id: string
  title: string
  detectedAt: Date
  status: RegisterStatus
  affectedCount: number
  dataCategories: string[]
  assessment: string | null
  notifiedAt: Date | null
}

// Deadline fields are computed, not stored, so they stay correct as time passes
// and are never out of sync with detectedAt.
function toRow(e: Entry): RegisterRow {
  // The countdown only matters while still assessing; once notified or ruled
  // out, the 72h clock is no longer pending.
  const pending = e.status === "ASSESSING"
  return {
    id: e.id,
    title: e.title,
    detectedAt: e.detectedAt.toISOString(),
    status: e.status,
    affectedCount: e.affectedCount,
    dataCategories: e.dataCategories,
    categoryLabels: e.dataCategories.map((c) => GDPR_CATEGORY_LABELS[c] ?? c),
    assessment: e.assessment,
    notifiedAt: e.notifiedAt?.toISOString() ?? null,
    deadline: notificationDeadline(e.detectedAt).toISOString(),
    hoursRemaining: hoursUntilDeadline(e.detectedAt),
    overdue: pending && isNotificationOverdue(e.detectedAt),
  }
}

export async function listRegister(companyId: string): Promise<RegisterRow[]> {
  const entries = await prisma.exposureRegisterEntry.findMany({
    where: { companyId },
    orderBy: { detectedAt: "desc" },
  })
  return entries.map(toRow)
}

const CSV_FIELDS: [string, (r: RegisterRow) => string | number][] = [
  ["Title", (r) => r.title],
  ["Detected at", (r) => r.detectedAt],
  ["Status", (r) => r.status],
  ["Affected employees", (r) => r.affectedCount],
  ["GDPR data categories", (r) => r.categoryLabels.join("; ")],
  ["72h deadline", (r) => r.deadline],
  ["Notified at", (r) => r.notifiedAt ?? ""],
  ["Assessment", (r) => r.assessment ?? ""],
]

function escapeCell(value: string | number): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Evidence pack: a flat field/value CSV documenting a single register entry, for
// an Article 33 notification dossier.
export function evidenceCsv(row: RegisterRow): string {
  return [["Field", "Value"], ...CSV_FIELDS.map(([label, get]) => [label, get(row)])]
    .map((r) => r.map(escapeCell).join(","))
    .join("\n")
}
