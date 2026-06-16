import { prisma } from "@/lib/prisma"
import { employeeWhere, NO_DEPARTMENT, type ReportFilters } from "./filters"
import { windows } from "./windows"
import type { Delta, ReportDeltas } from "./types"

function recordInWindow(f: ReportFilters, start: Date, end: Date) {
  return {
    detectedAt: { gte: start, lt: end },
    ...(f.dataType && { exposedData: { has: f.dataType } }),
  }
}

function alertDept(f: ReportFilters) {
  return f.department
    ? { employee: { department: f.department === NO_DEPARTMENT ? null : f.department } }
    : {}
}

async function newlyExposed(companyId: string, f: ReportFilters, start: Date, end: Date): Promise<number> {
  return prisma.employee.count({
    where: {
      ...employeeWhere(companyId, f),
      breachRecords: { some: recordInWindow(f, start, end) },
      // First-time exposure: no breach record (of the same data-type scope) before the window.
      NOT: {
        breachRecords: {
          some: { detectedAt: { lt: start }, ...(f.dataType && { exposedData: { has: f.dataType } }) },
        },
      },
    },
  })
}

function newBreaches(companyId: string, f: ReportFilters, start: Date, end: Date): Promise<number> {
  return prisma.breach.count({
    where: { records: { some: { employee: employeeWhere(companyId, f), ...recordInWindow(f, start, end) } } },
  })
}

function newAlerts(companyId: string, f: ReportFilters, start: Date, end: Date): Promise<number> {
  return prisma.alert.count({
    where: { companyId, createdAt: { gte: start, lt: end }, ...alertDept(f) },
  })
}

export async function getDeltas(companyId: string, f: ReportFilters): Promise<ReportDeltas> {
  const w = windows(f)

  const [
    exposedCur, exposedPrev,
    breachesCur, breachesPrev,
    alertsCur, alertsPrev,
  ] = await Promise.all([
    newlyExposed(companyId, f, w.curStart, w.curEnd),
    newlyExposed(companyId, f, w.prevStart, w.prevEnd),
    newBreaches(companyId, f, w.curStart, w.curEnd),
    newBreaches(companyId, f, w.prevStart, w.prevEnd),
    newAlerts(companyId, f, w.curStart, w.curEnd),
    newAlerts(companyId, f, w.prevStart, w.prevEnd),
  ])

  const delta = (current: number, previous: number): Delta => ({ current, previous })

  return {
    windowLabel: w.label,
    newlyExposed: delta(exposedCur, exposedPrev),
    newBreaches: delta(breachesCur, breachesPrev),
    newAlerts: delta(alertsCur, alertsPrev),
  }
}
