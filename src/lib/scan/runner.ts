import { prisma } from "@/lib/prisma"
import { decryptConfig } from "@/lib/directory/crypto"
import { emailEnabled, sendBreachAlert } from "@/lib/email"
import { dispatchWebhooks, loadActiveWebhooks } from "@/lib/webhooks"
import { providerById } from "./registry"
import { sleep } from "./normalize"
import type { BreachProvider, Finding } from "./types"
import type { ArtifactKind, BreachSource, Severity } from "@prisma/client"

const RATE_LIMIT_MS = 1500
const CRITICAL_TYPES = ["password", "hashed_password", "credit_card", "ssn", "bank_account"]

export type ActiveProvider = { provider: BreachProvider; key: string }
export type ScanResult = { scanned: number; newRecords: number; newAlerts: number }

type EmployeeWithRecords = {
  id: string
  email: string
  firstName: string
  lastName: string
}

// Load the providers that have a configured key for the company and decrypt
// their key server-side. Marks the used providers as recently queried.
export async function loadActiveProviders(companyId: string): Promise<ActiveProvider[]> {
  const creds = await prisma.apiCredential.findMany({ where: { companyId } })
  const active: ActiveProvider[] = []
  for (const cred of creds) {
    const provider = providerById(cred.provider)
    if (!provider) continue
    const { key } = decryptConfig<{ key: string }>(cred.encryptedKey)
    active.push({ provider, key })
  }
  if (active.length) {
    await prisma.apiCredential.updateMany({
      where: { companyId, provider: { in: active.map((a) => a.provider.id) } },
      data: { lastUsedAt: new Date() },
    })
  }
  return active
}

export function severityFor(dataTypes: string[], artifacts: ArtifactKind[] = []): Severity {
  // A live session cookie or token bypasses MFA, so it is always CRITICAL
  // regardless of how many classic data types leaked alongside it.
  if (artifacts.includes("COOKIE") || artifacts.includes("TOKEN")) return "CRITICAL"
  const critical = dataTypes.filter((d) => CRITICAL_TYPES.includes(d)).length
  if (critical >= 2) return "CRITICAL"
  if (critical === 1) return "HIGH"
  return "MEDIUM"
}

// Stealer-log findings read differently from breach-dump findings: name them as
// an infostealer exposure and call out a captured session when present, since
// that is the part a responder must rotate first.
function alertMessage(
  employeeName: string,
  finding: Finding,
  source: BreachSource,
  artifacts: ArtifactKind[]
): string {
  if (source !== "STEALER_LOG") {
    return `${employeeName} found in ${finding.name} breach.`
  }
  const session = artifacts.includes("COOKIE") || artifacts.includes("TOKEN")
  const what = session ? "active session token" : "credentials"
  return `${employeeName} ${what} exposed in stealer log (${finding.name}).`
}

// Persist a finding: create the breach if needed, then the record and alert when
// this employee was not already linked to it. Returns true if a record was created.
type Notify = {
  recipients: string[]
  webhooks: Awaited<ReturnType<typeof loadActiveWebhooks>>
}

async function persistFinding(
  companyId: string,
  employee: EmployeeWithRecords,
  finding: Finding,
  source: BreachSource,
  known: Set<string>,
  notify: Notify
): Promise<boolean> {
  const breach = await prisma.breach.upsert({
    where: { name: finding.name },
    update: {},
    create: {
      name: finding.name,
      source,
      breachDate: finding.breachDate,
      dataTypes: finding.dataTypes,
    },
  })
  if (known.has(breach.id)) return false

  const artifacts = finding.artifacts ?? []
  const severity = severityFor(finding.dataTypes, artifacts)
  const employeeName = `${employee.firstName} ${employee.lastName}`

  await prisma.breachRecord.create({
    data: {
      employeeId: employee.id,
      breachId: breach.id,
      exposedData: finding.dataTypes,
      artifacts,
      machineId: finding.machineId,
      malwareFamily: finding.malwareFamily,
      capturedAt: finding.capturedAt,
    },
  })
  await prisma.alert.create({
    data: {
      companyId,
      employeeId: employee.id,
      breachId: breach.id,
      severity,
      status: "OPEN",
      message: alertMessage(employeeName, finding, source, artifacts),
    },
  })

  const event = { employeeName, breachName: finding.name, dataTypes: finding.dataTypes, severity }
  await sendBreachAlert(notify.recipients, event)
  await dispatchWebhooks(notify.webhooks, event)

  known.add(breach.id)
  return true
}

async function notifyRecipients(companyId: string): Promise<string[]> {
  if (!emailEnabled()) return []
  const admins = await prisma.user.findMany({
    where: { companyId, role: "ADMIN" },
    select: { email: true },
  })
  return admins.map((a) => a.email)
}

// Scan every employee against every active provider. A provider error is isolated
// (we move on to the next one) so it never aborts the whole scan.
export async function runScan(
  companyId: string,
  providers: ActiveProvider[]
): Promise<ScanResult> {
  const employees = await prisma.employee.findMany({
    where: { companyId },
    include: { breachRecords: { select: { breachId: true } } },
  })
  const notify: Notify = {
    recipients: await notifyRecipients(companyId),
    webhooks: await loadActiveWebhooks(companyId),
  }

  let newRecords = 0
  for (const employee of employees) {
    const known = new Set(employee.breachRecords.map((r) => r.breachId))
    for (const { provider, key } of providers) {
      let findings: Finding[]
      try {
        findings = await provider.lookup(employee.email, key)
      } catch {
        continue
      }
      for (const finding of findings) {
        if (await persistFinding(companyId, employee, finding, provider.source, known, notify)) {
          newRecords++
        }
      }
    }
    await sleep(RATE_LIMIT_MS)
  }

  return { scanned: employees.length, newRecords, newAlerts: newRecords }
}
