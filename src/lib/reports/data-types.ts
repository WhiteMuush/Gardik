import { prisma } from "@/lib/prisma"
import { CRITICAL_DATA } from "@/lib/employees"
import { PRESET_DATA_TYPES } from "@/lib/dataTypes"
import { rate } from "./utils"
import type { DataTypeExposure } from "./types"

const LABELS = new Map<string, string>(PRESET_DATA_TYPES.map((t) => [t.key, t.label]))

export async function getDataTypeExposure(companyId: string): Promise<DataTypeExposure[]> {
  const records = await prisma.breachRecord.findMany({
    where: { employee: { companyId } },
    select: { exposedData: true },
  })

  const counts = new Map<string, number>()
  let total = 0
  records.forEach((r) =>
    r.exposedData.forEach((type) => {
      counts.set(type, (counts.get(type) ?? 0) + 1)
      total++
    })
  )

  return [...counts.entries()]
    .map(([type, count]) => ({
      type,
      label: LABELS.get(type) ?? type,
      count,
      percentage: rate(count, total),
      critical: CRITICAL_DATA.includes(type.toLowerCase()),
    }))
    .sort((a, b) => b.count - a.count)
}
