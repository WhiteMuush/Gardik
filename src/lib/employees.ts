import { prisma } from "@/lib/prisma"
import {
  buildEmployeeRiskInput,
  CRITICAL_DATA,
  employeeRiskScore,
  getRiskLevel,
  resolveRiskWeights,
} from "@/lib/risk"
import type { Prisma } from "@prisma/client"

export { CRITICAL_DATA }

export type GetEmployeesOpts = {
  where?: Prisma.EmployeeWhereInput
  recordWhere?: Prisma.BreachRecordWhereInput
}

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
  riskScore: number
  riskLevel: RiskLevel
  breachRecords: BreachRecordDetail[]
}

export async function getEmployees(companyId: string, opts?: GetEmployeesOpts): Promise<EmployeeRow[]> {
  const [company, employees] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { domain: true, riskWeights: true } }),
    prisma.employee.findMany({
      where: { companyId, ...opts?.where },
      include: {
        breachRecords: {
          where: opts?.recordWhere,
          include: { breach: true },
          orderBy: { detectedAt: "desc" },
        },
        alerts: { where: { status: { not: "RESOLVED" } }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const weights = resolveRiskWeights(company?.riskWeights)
  const companyDomain = company?.domain ?? ""

  return employees.map((emp) => {
    const records = emp.breachRecords
    const riskScore = employeeRiskScore(
      buildEmployeeRiskInput({
        email: emp.email,
        companyDomain,
        records,
        openAlerts: emp.alerts.length,
      }),
      weights
    )
    return {
      id: emp.id,
      email: emp.email,
      firstName: emp.firstName,
      lastName: emp.lastName,
      department: emp.department,
      breachCount: records.length,
      lastDetectedAt: records[0]?.detectedAt ?? null,
      exposedDataTypes: [...new Set(records.flatMap((r) => r.exposedData))],
      riskScore,
      riskLevel: riskScore === 0 ? "OK" : getRiskLevel(riskScore).level,
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
