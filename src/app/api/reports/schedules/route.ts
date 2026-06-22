import { NextResponse } from "next/server"
import { requireAuth, requireAdmin } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { isReportSection } from "@/lib/reportSchedules"
import { ScheduleFrequency } from "@prisma/client"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const SELECT = {
  id: true,
  frequency: true,
  recipients: true,
  sections: true,
  enabled: true,
  lastSentAt: true,
} as const

export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  return NextResponse.json(
    await prisma.reportSchedule.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { createdAt: "desc" },
      select: SELECT,
    })
  )
}

export async function POST(req: Request) {
  const { session, error } = await requireAdmin()
  if (error) return error

  const body = (await req.json()) as {
    frequency?: string
    recipients?: string[]
    sections?: string[]
  }

  if (!body.frequency || !(body.frequency in ScheduleFrequency))
    return NextResponse.json({ error: "Invalid frequency" }, { status: 400 })

  const recipients = (body.recipients ?? []).map((r) => r.trim().toLowerCase()).filter(Boolean)
  if (recipients.length === 0 || !recipients.every((r) => EMAIL_RE.test(r)))
    return NextResponse.json({ error: "Provide at least one valid recipient email" }, { status: 400 })

  const sections = (body.sections ?? []).filter(isReportSection)
  if (sections.length === 0)
    return NextResponse.json({ error: "Select at least one report section" }, { status: 400 })

  const schedule = await prisma.reportSchedule.create({
    data: {
      companyId: session.user.companyId,
      frequency: body.frequency as ScheduleFrequency,
      recipients,
      sections,
    },
    select: SELECT,
  })
  return NextResponse.json(schedule, { status: 201 })
}
