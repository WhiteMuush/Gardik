import { prisma } from "@/lib/prisma"
import { emailEnabled, sendBreachAlert } from "@/lib/email"
import { dispatchWebhooks, type loadActiveWebhooks } from "@/lib/webhooks"
import { confidenceForProvider } from "@/lib/credentials/providers"
import { ADMINISTRATOR } from "@/lib/rbac/presets"
import { canonicalBreachKey } from "./normalize"
import { SEVERITY_RANK, bumpConfidence, moreConfident, moreSevere, severityFor } from "./severity"
import type { Finding } from "./types"
import type { AlertConfidence, ApiProvider, ArtifactKind, BreachSource, Severity } from "@prisma/client"

type EmployeeWithRecords = {
  id: string
  email: string
  firstName: string
  lastName: string
}

function union<T>(a: readonly T[], b: readonly T[]): T[] {
  return [...new Set([...a, ...b])]
}

// The live record and alert of one canonical breach, so a second provider corroborates instead of duplicating.
export type Corroboration = {
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

// Stealer-log alerts name the infostealer and call out a captured session, the first thing to rotate.
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

export type Notify = {
  recipients: string[]
  webhooks: Awaited<ReturnType<typeof loadActiveWebhooks>>
}

// Merges a second tool's report into the existing record and raises confidence, with no new alert or notification.
async function corroborate(
  state: Corroboration,
  finding: Finding,
  source: BreachSource,
  providerId: ApiProvider
): Promise<void> {
  // The same provider re-reporting the same breach adds nothing.
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

// Creates the breach, record and alert the first time a canonical breach is seen, else corroborates; true if new.
export async function handleFinding(
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

export async function notifyRecipients(companyId: string): Promise<string[]> {
  if (!emailEnabled()) return []
  const admins = await prisma.user.findMany({
    where: { companyId, role: { name: ADMINISTRATOR } },
    select: { email: true },
  })
  return admins.map((a) => a.email)
}
