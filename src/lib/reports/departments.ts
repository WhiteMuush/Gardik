import { prisma } from "@/lib/prisma"
import { rate } from "./utils"
import type { DepartmentRow } from "./types"

export async function getDepartmentBreakdown(companyId: string): Promise<DepartmentRow[]> {
  const employees = await prisma.employee.findMany({
    where: { companyId },
    select: { department: true, _count: { select: { breachRecords: true } } },
  })

  const depts = new Map<string, { total: number; exposed: number }>()
  employees.forEach((e) => {
    const name = e.department ?? "Unknown"
    const entry = depts.get(name) ?? { total: 0, exposed: 0 }
    entry.total++
    if (e._count.breachRecords > 0) entry.exposed++
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
