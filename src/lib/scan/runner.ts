import { prisma } from "@/lib/prisma"
import { decryptConfig } from "@/lib/directory/crypto"
import { providerById } from "./registry"
import { sleep } from "./normalize"
import type { BreachProvider, Finding } from "./types"
import type { BreachSource, Severity } from "@prisma/client"

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

// Charge les providers ayant une clé configurée pour l'entreprise et déchiffre
// leur clé côté serveur. Marque les providers utilisés comme récemment sollicités.
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

function severityFor(dataTypes: string[]): Severity {
  const critical = dataTypes.filter((d) => CRITICAL_TYPES.includes(d)).length
  if (critical >= 2) return "CRITICAL"
  if (critical === 1) return "HIGH"
  return "MEDIUM"
}

// Enregistre une trouvaille : crée le breach si besoin, puis le record et l'alerte
// si cet employé n'y était pas déjà associé. Renvoie true si un record a été créé.
async function persistFinding(
  companyId: string,
  employee: EmployeeWithRecords,
  finding: Finding,
  source: BreachSource,
  known: Set<string>
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

  await prisma.breachRecord.create({
    data: { employeeId: employee.id, breachId: breach.id, exposedData: finding.dataTypes },
  })
  await prisma.alert.create({
    data: {
      companyId,
      employeeId: employee.id,
      breachId: breach.id,
      severity: severityFor(finding.dataTypes),
      status: "OPEN",
      message: `${employee.firstName} ${employee.lastName} found in ${finding.name} breach.`,
    },
  })
  known.add(breach.id)
  return true
}

// Scanne chaque employé contre chaque provider actif. Une erreur provider est
// isolée (on passe au suivant) pour ne pas interrompre tout le scan.
export async function runScan(
  companyId: string,
  providers: ActiveProvider[]
): Promise<ScanResult> {
  const employees = await prisma.employee.findMany({
    where: { companyId },
    include: { breachRecords: { select: { breachId: true } } },
  })

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
        if (await persistFinding(companyId, employee, finding, provider.source, known)) {
          newRecords++
        }
      }
    }
    await sleep(RATE_LIMIT_MS)
  }

  return { scanned: employees.length, newRecords, newAlerts: newRecords }
}
