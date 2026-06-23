import { prisma } from "@/lib/prisma"
import { decryptConfig } from "@/lib/directory/crypto"
import { emailEnabled, sendBreachAlert } from "@/lib/email"
import { dispatchWebhooks, loadActiveWebhooks } from "@/lib/webhooks"
import { confidenceForProvider } from "@/lib/credentials/providers"
import { providerById } from "./registry"
import { canonicalBreachKey, sleep } from "./normalize"
import type { BreachProvider, Finding } from "./types"
import type { AlertConfidence, ApiProvider, ArtifactKind, BreachSource, Severity } from "@prisma/client"

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

export function severityFor(
  dataTypes: string[],
  artifacts: ArtifactKind[] = [],
  source: BreachSource = "MANUAL"
): Severity {
  // A live session cookie or token bypasses MFA, so it is always CRITICAL
  // regardless of source or how many classic data types leaked alongside it.
  if (artifacts.includes("COOKIE") || artifacts.includes("TOKEN")) return "CRITICAL"

  const critical = dataTypes.filter((d) => CRITICAL_TYPES.includes(d)).length

  // A stealer log proves an active malware infection on the endpoint: the
  // machine is owned right now. That raises the floor a full tier above an
  // equivalent breach dump. A stolen plaintext password (or any critical data)
  // off an infected host is CRITICAL; bare infection is still at least HIGH.
  if (source === "STEALER_LOG") {
    return critical >= 1 || artifacts.includes("PASSWORD") ? "CRITICAL" : "HIGH"
  }

  // Dark-web sources mean the data is actively traded, but they often carry no
  // structured data types (an email merely seen in a bucket). Without a
  // per-provider confidence axis, bare dark-web presence stays MEDIUM to avoid
  // flooding HIGH alerts from noisy aggregators; a known credential still lifts
  // it. Curated dumps (HIBP) and manual entries share the same data-type logic.
  if (critical >= 2) return "CRITICAL"
  if (critical === 1) return "HIGH"
  return "MEDIUM"
}

const SEVERITY_RANK: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
const CONFIDENCE_ORDER: AlertConfidence[] = ["LOW", "MEDIUM", "HIGH"]

function moreSevere(a: Severity, b: Severity): Severity {
  return SEVERITY_RANK[a] <= SEVERITY_RANK[b] ? a : b
}

function moreConfident(a: AlertConfidence, b: AlertConfidence): AlertConfidence {
  return CONFIDENCE_ORDER.indexOf(a) >= CONFIDENCE_ORDER.indexOf(b) ? a : b
}

function bumpConfidence(c: AlertConfidence): AlertConfidence {
  return CONFIDENCE_ORDER[Math.min(CONFIDENCE_ORDER.indexOf(c) + 1, CONFIDENCE_ORDER.length - 1)]
}

function union<T>(a: readonly T[], b: readonly T[]): T[] {
  return [...new Set([...a, ...b])]
}

// Per-employee state for one canonical breach: the live record/alert plus the
// merged exposure so a second provider reporting the same breach corroborates
// it instead of raising a duplicate.
type Corroboration = {
  breachId: string
  recordId: string
  alertId: string | null
  exposedData: string[]
  artifacts: ArtifactKind[]
  sources: ApiProvider[]
  source: BreachSource
  severity: Severity
  confidence: AlertConfidence
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

type Notify = {
  recipients: string[]
  webhooks: Awaited<ReturnType<typeof loadActiveWebhooks>>
}

// A second tool reporting the same canonical breach for an employee: merge its
// exposure into the existing record and raise confidence (two independent tools
// corroborate), without creating a duplicate record or alert. No re-notify.
async function corroborate(
  state: Corroboration,
  finding: Finding,
  source: BreachSource,
  providerId: ApiProvider
): Promise<void> {
  // Same provider re-reporting the same breach adds nothing.
  if (state.sources.includes(providerId)) return

  const artifacts = finding.artifacts ?? []
  const exposedData = union(state.exposedData, finding.dataTypes)
  const mergedArtifacts = union(state.artifacts, artifacts)
  const sources = [...state.sources, providerId]
  // Keep whichever source yields the more severe reading over the merged data.
  const sourceSeverity = severityFor(exposedData, mergedArtifacts, source)
  const keptSeverity = severityFor(exposedData, mergedArtifacts, state.source)
  const source2 = SEVERITY_RANK[sourceSeverity] < SEVERITY_RANK[keptSeverity] ? source : state.source
  const severity = moreSevere(sourceSeverity, keptSeverity)
  let confidence = moreConfident(state.confidence, confidenceForProvider(providerId))
  if (sources.length >= 2) confidence = bumpConfidence(confidence)

  await prisma.breachRecord.update({
    where: { id: state.recordId },
    data: { exposedData, artifacts: mergedArtifacts, sources },
  })
  if (state.alertId) {
    await prisma.alert.update({ where: { id: state.alertId }, data: { severity, confidence } })
  }

  state.exposedData = exposedData
  state.artifacts = mergedArtifacts
  state.sources = sources
  state.source = source2
  state.severity = severity
  state.confidence = confidence
}

// Persist a finding for an employee. Creates the breach, record and alert the
// first time this canonical breach is seen; otherwise corroborates the existing
// one. Returns true only when a new record was created.
async function handleFinding(
  companyId: string,
  employee: EmployeeWithRecords,
  finding: Finding,
  source: BreachSource,
  providerId: ApiProvider,
  byCanonical: Map<string, Corroboration>,
  notify: Notify
): Promise<boolean> {
  const key = canonicalBreachKey(finding.name)
  const existing = byCanonical.get(key)
  if (existing) {
    await corroborate(existing, finding, source, providerId)
    return false
  }

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

  const artifacts = finding.artifacts ?? []
  const severity = severityFor(finding.dataTypes, artifacts, source)
  const confidence = confidenceForProvider(providerId)
  const employeeName = `${employee.firstName} ${employee.lastName}`

  const record = await prisma.breachRecord.create({
    data: {
      employeeId: employee.id,
      breachId: breach.id,
      exposedData: finding.dataTypes,
      artifacts,
      sources: [providerId],
      machineId: finding.machineId,
      malwareFamily: finding.malwareFamily,
      capturedAt: finding.capturedAt,
    },
  })
  const alert = await prisma.alert.create({
    data: {
      companyId,
      employeeId: employee.id,
      breachId: breach.id,
      severity,
      confidence,
      status: "OPEN",
      message: alertMessage(employeeName, finding, source, artifacts),
    },
  })

  const event = { employeeName, breachName: finding.name, dataTypes: finding.dataTypes, severity }
  await sendBreachAlert(notify.recipients, event)
  await dispatchWebhooks(notify.webhooks, event)

  byCanonical.set(key, {
    breachId: breach.id,
    recordId: record.id,
    alertId: alert.id,
    exposedData: finding.dataTypes,
    artifacts,
    sources: [providerId],
    source,
    severity,
    confidence,
  })
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
    include: {
      breachRecords: {
        select: {
          id: true,
          breachId: true,
          exposedData: true,
          artifacts: true,
          sources: true,
          breach: { select: { name: true, source: true } },
        },
      },
      alerts: { select: { id: true, breachId: true, severity: true, confidence: true } },
    },
  })
  const notify: Notify = {
    recipients: await notifyRecipients(companyId),
    webhooks: await loadActiveWebhooks(companyId),
  }

  let newRecords = 0
  for (const employee of employees) {
    // Seed the canonical map from what the employee already has, so a breach
    // first seen in an earlier scan still dedups against this run's findings.
    const alertByBreach = new Map(
      employee.alerts.flatMap((a) => (a.breachId ? [[a.breachId, a] as const] : []))
    )
    const byCanonical = new Map<string, Corroboration>()
    for (const r of employee.breachRecords) {
      const ckey = canonicalBreachKey(r.breach.name)
      if (byCanonical.has(ckey)) continue
      const al = alertByBreach.get(r.breachId)
      byCanonical.set(ckey, {
        breachId: r.breachId,
        recordId: r.id,
        alertId: al?.id ?? null,
        exposedData: r.exposedData,
        artifacts: r.artifacts,
        sources: r.sources,
        source: r.breach.source,
        severity: al?.severity ?? severityFor(r.exposedData, r.artifacts, r.breach.source),
        confidence: al?.confidence ?? confidenceForProvider(r.sources[0] ?? "HIBP"),
      })
    }

    for (const { provider, key } of providers) {
      let findings: Finding[]
      try {
        findings = await provider.lookup(employee.email, key)
      } catch {
        continue
      }
      for (const finding of findings) {
        if (await handleFinding(companyId, employee, finding, provider.source, provider.id, byCanonical, notify)) {
          newRecords++
        }
      }
    }
    await sleep(RATE_LIMIT_MS)
  }

  return { scanned: employees.length, newRecords, newAlerts: newRecords }
}
