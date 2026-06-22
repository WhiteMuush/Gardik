import { prisma } from "@/lib/prisma"
import { getReportData } from "@/lib/reports"
import { reportCsv } from "@/lib/reports/csv"
import { reportHtml, type ReportSection } from "@/lib/reports/html"
import { sendEmail } from "@/lib/email"
import { isDue } from "@/lib/scheduler"
import type { ScheduleFrequency } from "@prisma/client"

const FREQUENCY_MINUTES: Record<ScheduleFrequency, number> = {
  WEEKLY: 7 * 24 * 60,
  MONTHLY: 30 * 24 * 60,
}

const VALID_SECTIONS: ReportSection[] = [
  "exposure",
  "datatypes",
  "departments",
  "employees",
  "trends",
  "compliance",
]

export function isReportSection(value: string): value is ReportSection {
  return (VALID_SECTIONS as string[]).includes(value)
}

type Schedule = {
  id: string
  companyId: string
  frequency: ScheduleFrequency
  recipients: string[]
  sections: string[]
}

// Build the report for a schedule and email it (HTML body + full-report CSV
// attachment). Returns whether the email was dispatched.
export async function sendScheduledReport(schedule: Schedule): Promise<boolean> {
  if (schedule.recipients.length === 0) return false
  const sections = schedule.sections.filter(isReportSection)
  if (sections.length === 0) return false

  const data = await getReportData(schedule.companyId)
  const html = reportHtml(sections, data)
  const csv = reportCsv("all", data)
  const date = new Date().toISOString().slice(0, 10)

  return sendEmail(schedule.recipients, `DataShield report - ${date}`, html, [
    { filename: `datashield-report-${date}.csv`, content: Buffer.from(csv).toString("base64") },
  ])
}

// Send every enabled schedule whose interval has elapsed, stamping lastSentAt
// only on a successful dispatch so a failure is retried next tick.
export async function runDueReportSchedules(now: Date = new Date()): Promise<{ sent: number }> {
  const schedules = await prisma.reportSchedule.findMany({ where: { enabled: true } })
  let sent = 0
  for (const s of schedules) {
    if (!isDue(s.lastSentAt, FREQUENCY_MINUTES[s.frequency], now)) continue
    if (await sendScheduledReport(s)) {
      await prisma.reportSchedule.update({ where: { id: s.id }, data: { lastSentAt: now } })
      sent++
    }
  }
  return { sent }
}
