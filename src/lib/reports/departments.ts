import { prisma } from "@/lib/prisma"
import { rate } from "./utils"
import { breachRecordSome, employeeWhere, type ReportFilters } from "./filters"
import type { DepartmentRow } from "./types"

export async function getDepartmentBreakdown(companyId: string, f: ReportFilters): Promise<DepartmentRow[]> {
  const employees = await prisma.employee.findMany({
    where: employeeWhere(companyId, f),
    select: {
      department: true,
      breachRecords: { where: breachRecordSome(f), select: { id: true }, take: 1 },
    },
  })

  const depts = new Map<string, { total: number; exposed: number }>()
  employees.forEach((e) => {
    const name = e.department ?? "Unknown"
    const entry = depts.get(name) ?? { total: 0, exposed: 0 }
    entry.total++
    if (e.breachRecords.length > 0) entry.exposed++
    depts.set(name, entry)
  })

  return [...depts.entries()]
    .map(([department, { total, exposed }]) => ({
      department,
      total,
      exposed,
      exposureRate: rate(exposed, total),
    }))
    .sort((a, b) => b.exposed - a.exposed || b.total - a.total)
}
