import { prisma } from "@/lib/prisma"
import { fmtDate, mfaLabel, prettyList, remediationGroup, type DetailResponse, type Group } from "./format"

export async function employeeDetail(id: string, companyId: string): Promise<DetailResponse | null> {
  const emp = await prisma.employee.findFirst({
    where: { id, companyId },
    include: {
      breachRecords: { include: { breach: true }, orderBy: { detectedAt: "desc" } },
      alerts: { include: { breach: true }, orderBy: { createdAt: "desc" } },
    },
  })
  if (!emp) return null

  const openAlerts = emp.alerts.filter((a) => a.status === "OPEN").length
  const groups: Group[] = [
    {
      fields: [
        { label: "Email", value: emp.email },
        { label: "Department", value: emp.department ?? "Unknown" },
        { label: "MFA", value: mfaLabel(emp.mfaEnabled) },
        { label: "Breaches", value: emp.breachRecords.length },
        { label: "Open alerts", value: openAlerts },
      ],
    },
    ...emp.breachRecords.map((r) => ({
      heading: r.breach.name,
      fields: [
        { label: "Breach date", value: fmtDate(r.breach.breachDate) },
        { label: "Detected", value: fmtDate(r.detectedAt) },
        { label: "Exposed data", value: prettyList(r.exposedData) },
        ...(r.artifacts.length ? [{ label: "Artifacts", value: prettyList(r.artifacts) }] : []),
        { label: "Reported by", value: r.sources.length ? r.sources.join(", ") : r.breach.source },
        ...(r.malwareFamily ? [{ label: "Malware", value: r.malwareFamily }] : []),
        ...(r.machineId ? [{ label: "Machine ID", value: r.machineId }] : []),
        ...(r.capturedAt ? [{ label: "Captured", value: fmtDate(r.capturedAt) }] : []),
      ],
    })),
  ]

  const empRemediations = await prisma.remediationAction.findMany({
    where: { employeeId: id, companyId },
    orderBy: { createdAt: "desc" },
    take: 20,
  })
  groups.push(...remediationGroup(empRemediations))

  return {
    title: `${emp.firstName} ${emp.lastName}`,
    subtitle: emp.department ?? emp.email,
    variant: openAlerts > 0 ? "critical" : emp.breachRecords.length > 0 ? "high" : "ok",
    groups,
  }
}

export async function breachDetail(id: string, companyId: string): Promise<DetailResponse | null> {
  const breach = await prisma.breach.findFirst({
    where: { id },
    include: {
      records: { include: { employee: true }, orderBy: { detectedAt: "desc" } },
    },
  })
  // Scope: only expose breaches that hit this company's employees.
  const own = breach?.records.filter((r) => r.employee.companyId === companyId) ?? []
  if (!breach || own.length === 0) return null

  const groups: Group[] = [
    {
      fields: [
        { label: "Source", value: breach.source },
        { label: "Breach date", value: fmtDate(breach.breachDate) },
        { label: "Affected employees", value: own.length },
        { label: "Data types", value: prettyList(breach.dataTypes) },
        ...(breach.description ? [{ label: "Description", value: breach.description }] : []),
      ],
    },
    ...own.slice(0, 50).map((r) => ({
      heading: `${r.employee.firstName} ${r.employee.lastName}`,
      fields: [
        { label: "Department", value: r.employee.department ?? "Unknown" },
        { label: "Exposed data", value: prettyList(r.exposedData) },
        ...(r.artifacts.length ? [{ label: "Artifacts", value: prettyList(r.artifacts) }] : []),
        { label: "Detected", value: fmtDate(r.detectedAt) },
      ],
    })),
  ]

  return {
    title: breach.name,
    subtitle: String(breach.source),
    variant: "medium",
    tags: breach.dataTypes.map((t) => t.replace(/_/g, " ")),
    groups,
  }
}

export async function alertDetail(id: string, companyId: string): Promise<DetailResponse | null> {
  const alert = await prisma.alert.findFirst({
    where: { id, companyId },
    include: {
      employee: { include: { breachRecords: { include: { breach: true } } } },
      breach: true,
    },
  })
  if (!alert) return null

  const groups: Group[] = [
    {
      fields: [
        { label: "Severity", value: alert.severity },
        { label: "Confidence", value: alert.confidence },
        { label: "Status", value: alert.status },
        { label: "Created", value: fmtDate(alert.createdAt) },
        { label: "Message", value: alert.message },
      ],
    },
  ]
  if (alert.employee) {
    groups.push({
      heading: `${alert.employee.firstName} ${alert.employee.lastName}`,
      fields: [
        { label: "Email", value: alert.employee.email },
        { label: "Department", value: alert.employee.department ?? "Unknown" },
        { label: "Total breaches", value: alert.employee.breachRecords.length },
        { label: "MFA", value: mfaLabel(alert.employee.mfaEnabled) },
      ],
    })
  }
  if (alert.breach) {
    groups.push({
      heading: alert.breach.name,
      fields: [
        { label: "Source", value: alert.breach.source },
        { label: "Breach date", value: fmtDate(alert.breach.breachDate) },
        { label: "Data types", value: prettyList(alert.breach.dataTypes) },
      ],
    })
  }

  const alertRemediations = await prisma.remediationAction.findMany({
    where: { alertId: id, companyId },
    orderBy: { createdAt: "desc" },
    take: 20,
  })
  groups.push(...remediationGroup(alertRemediations))

  return {
    title: alert.employee ? `${alert.employee.firstName} ${alert.employee.lastName}` : "Alert",
    subtitle: alert.breach?.name ?? String(alert.severity),
    variant: String(alert.severity).toLowerCase(),
    groups,
  }
}
