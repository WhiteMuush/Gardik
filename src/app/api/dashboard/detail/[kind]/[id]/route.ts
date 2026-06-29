import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

// Rich detail for the dashboard drawer. Each widget element links to one of
// these entities; the drawer fetches the full record on click so it can show
// far more than the compact row carries.

type Field = { label: string; value: string | number }
type Group = { heading?: string; fields: Field[] }
type DetailResponse = {
  title: string
  subtitle?: string
  variant?: string
  tags?: string[]
  groups: Group[]
}

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })

const prettyList = (xs: string[]) =>
  xs.length ? xs.map((x) => x.replace(/_/g, " ")).join(", ") : "None"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ kind: string; id: string }> }
) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { kind, id } = await params
  const companyId = session.user.companyId

  if (kind === "employee") {
    const emp = await prisma.employee.findFirst({
      where: { id, companyId },
      include: {
        breachRecords: { include: { breach: true }, orderBy: { detectedAt: "desc" } },
        alerts: { include: { breach: true }, orderBy: { createdAt: "desc" } },
      },
    })
    if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const openAlerts = emp.alerts.filter((a) => a.status === "OPEN").length
    const groups: Group[] = [
      {
        fields: [
          { label: "Email", value: emp.email },
          { label: "Department", value: emp.department ?? "Unknown" },
          { label: "MFA", value: emp.mfaEnabled == null ? "Unknown" : emp.mfaEnabled ? "Enabled" : "Disabled" },
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
    if (empRemediations.length) {
      groups.push({
        heading: "Remediation",
        fields: empRemediations.map((a) => ({
          label: `${a.action} (${a.status})`,
          value: fmtDate(a.createdAt),
        })),
      })
    }

    return NextResponse.json({
      title: `${emp.firstName} ${emp.lastName}`,
      subtitle: emp.department ?? emp.email,
      variant: openAlerts > 0 ? "critical" : emp.breachRecords.length > 0 ? "high" : "ok",
      groups,
    } satisfies DetailResponse)
  }

  if (kind === "breach") {
    const breach = await prisma.breach.findFirst({
      where: { id },
      include: {
        records: { include: { employee: true }, orderBy: { detectedAt: "desc" } },
      },
    })
    // Scope: only expose breaches that hit this company's employees.
    const own = breach?.records.filter((r) => r.employee.companyId === companyId) ?? []
    if (!breach || own.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

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

    return NextResponse.json({
      title: breach.name,
      subtitle: String(breach.source),
      variant: "medium",
      tags: breach.dataTypes.map((t) => t.replace(/_/g, " ")),
      groups,
    } satisfies DetailResponse)
  }

  if (kind === "alert") {
    const alert = await prisma.alert.findFirst({
      where: { id, companyId },
      include: {
        employee: { include: { breachRecords: { include: { breach: true } } } },
        breach: true,
      },
    })
    if (!alert) return NextResponse.json({ error: "Not found" }, { status: 404 })

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
          { label: "MFA", value: alert.employee.mfaEnabled == null ? "Unknown" : alert.employee.mfaEnabled ? "Enabled" : "Disabled" },
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
    if (alertRemediations.length) {
      groups.push({
        heading: "Remediation",
        fields: alertRemediations.map((a) => ({
          label: `${a.action} (${a.status})`,
          value: fmtDate(a.createdAt),
        })),
      })
    }

    return NextResponse.json({
      title: alert.employee ? `${alert.employee.firstName} ${alert.employee.lastName}` : "Alert",
      subtitle: alert.breach?.name ?? String(alert.severity),
      variant: String(alert.severity).toLowerCase(),
      groups,
    } satisfies DetailResponse)
  }

  return NextResponse.json({ error: "Unknown detail kind" }, { status: 400 })
}
