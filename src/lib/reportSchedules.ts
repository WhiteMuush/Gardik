import { prisma } from "@/lib/prisma"
import { getReportData } from "@/lib/reports"
import { reportCsv } from "@/lib/reports/csv"
import { reportHtml, type ReportSection } from "@/lib/reports/html"
import { reportPdf } from "@/lib/reports/pdf"
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

// Emails the report as HTML with a full CSV attachment, returning whether it was dispatched.
export async function sendScheduledReport(schedule: Schedule): Promise<boolean> {
  if (schedule.recipients.length === 0) return false
  const sections = schedule.sections.filter(isReportSection)
  if (sections.length === 0) return false

  const data = await getReportData(schedule.companyId)
  const html = reportHtml(sections, data)
  const csv = reportCsv("all", data)
  const pdf = await reportPdf(sections, data)
  const date = new Date().toISOString().slice(0, 10)

  return sendEmail(schedule.recipients, `Gardik report - ${date}`, html, [
    { filename: `gardik-report-${date}.pdf`, content: pdf.toString("base64") },
    { filename: `gardik-report-${date}.csv`, content: Buffer.from(csv).toString("base64") },
  ])
}

// Stamps lastSentAt only on success, so a failed send is retried next tick.
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
