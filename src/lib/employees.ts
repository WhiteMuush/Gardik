import { prisma } from "@/lib/prisma"

export type RiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "OK"

export type BreachRecordDetail = {
  id: string
  breachName: string
  breachDate: Date
  source: string
  exposedData: string[]
  detectedAt: Date
}

export type EmployeeRow = {
  id: string
  email: string
  firstName: string
  lastName: string
  department: string | null
  breachCount: number
  lastDetectedAt: Date | null
  exposedDataTypes: string[]
  riskLevel: RiskLevel
  breachRecords: BreachRecordDetail[]
}

export async function getEmployees(companyId: string): Promise<EmployeeRow[]> {
  const employees = await prisma.employee.findMany({
    where: { companyId },
    include: {
      breachRecords: {
        include: { breach: true },
        orderBy: { detectedAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return employees.map((emp) => {
    const records = emp.breachRecords
    return {
      id: emp.id,
      email: emp.email,
      firstName: emp.firstName,
      lastName: emp.lastName,
      department: emp.department,
      breachCount: records.length,
      lastDetectedAt: records[0]?.detectedAt ?? null,
      exposedDataTypes: [...new Set(records.flatMap((r) => r.exposedData))],
      riskLevel: calculateRisk(records.flatMap((r) => r.exposedData), records.length),
      breachRecords: records.map((r) => ({
        id: r.id,
        breachName: r.breach.name,
        breachDate: r.breach.breachDate,
        source: r.breach.source,
        exposedData: r.exposedData,
        detectedAt: r.detectedAt,
      })),
    }
  })
}

export const CRITICAL_DATA = ["password", "credit_card", "ssn", "bank_account", "financial"]

function calculateRisk(dataTypes: string[], breachCount: number): RiskLevel {
  if (breachCount === 0) return "OK"
  const hasCritical = dataTypes.some((d) => CRITICAL_DATA.includes(d.toLowerCase()))
  if (hasCritical && breachCount > 1) return "CRITICAL"
  if (hasCritical) return "HIGH"
  if (breachCount > 3) return "HIGH"
  if (breachCount > 1) return "MEDIUM"
  return "LOW"
}
