import type { Prisma } from "@prisma/client"

// Sentinel for the "Unknown" department bucket (employees with department = null).
export const NO_DEPARTMENT = "__none__"

export type ReportFilters = {
  from: string | null // ISO date (YYYY-MM-DD)
  to: string | null
  department: string | null
  dataType: string | null
}

export const EMPTY_FILTERS: ReportFilters = {
  from: null,
  to: null,
  department: null,
  dataType: null,
}

export function parseReportFilters(params: URLSearchParams): ReportFilters {
  const get = (k: string) => {
    const v = params.get(k)
    return v && v.trim() !== "" ? v : null
  }
  return {
    from: get("from"),
    to: get("to"),
    department: get("department"),
    dataType: get("dataType"),
  }
}

export function hasActiveFilters(f: ReportFilters): boolean {
  return Boolean(f.from || f.to || f.department || f.dataType)
}

// Serialize back to a query string (for export links etc.). Skips empty values.
export function filtersToQuery(f: ReportFilters): string {
  const p = new URLSearchParams()
  if (f.from) p.set("from", f.from)
  if (f.to) p.set("to", f.to)
  if (f.department) p.set("department", f.department)
  if (f.dataType) p.set("dataType", f.dataType)
  return p.toString()
}

function dateRange(f: ReportFilters): Prisma.DateTimeFilter | undefined {
  if (!f.from && !f.to) return undefined
  const range: Prisma.DateTimeFilter = {}
  if (f.from) range.gte = new Date(`${f.from}T00:00:00.000`)
  if (f.to) range.lte = new Date(`${f.to}T23:59:59.999`)
  return range
}

function departmentClause(f: ReportFilters): { department: string | null } | undefined {
  if (!f.department) return undefined
  return { department: f.department === NO_DEPARTMENT ? null : f.department }
}

// Record-level constraints (date + exposed data type), no employee clause.
export function breachRecordSome(f: ReportFilters): Prisma.BreachRecordWhereInput {
  const where: Prisma.BreachRecordWhereInput = {}
  const range = dateRange(f)
  if (range) where.detectedAt = range
  if (f.dataType) where.exposedData = { has: f.dataType }
  return where
}

// Employee population filtered by department.
export function employeeWhere(companyId: string, f: ReportFilters): Prisma.EmployeeWhereInput {
  return { companyId, ...departmentClause(f) }
}

// Employees considered "exposed" within the active filters: matching department AND
// having at least one breach record inside the date / data-type constraints.
export function exposedEmployeeWhere(companyId: string, f: ReportFilters): Prisma.EmployeeWhereInput {
  const some = breachRecordSome(f)
  return {
    companyId,
    ...departmentClause(f),
    breachRecords: { some: Object.keys(some).length ? some : {} },
  }
}

// Breach records scoped to the company + all active filters.
export function breachRecordWhere(companyId: string, f: ReportFilters): Prisma.BreachRecordWhereInput {
  return {
    employee: employeeWhere(companyId, f),
    ...breachRecordSome(f),
  }
}

// Alerts scoped to the company + date range + department (via linked employee).
export function alertWhere(companyId: string, f: ReportFilters): Prisma.AlertWhereInput {
  const where: Prisma.AlertWhereInput = { companyId }
  const range = dateRange(f)
  if (range) where.createdAt = range
  const dept = departmentClause(f)
  if (dept) where.employee = dept
  return where
}
