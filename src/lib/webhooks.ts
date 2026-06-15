import { prisma } from "@/lib/prisma"
import { decryptConfig } from "@/lib/directory/crypto"
import type { Severity } from "@prisma/client"

export type WebhookRow = {
  id: string
  label: string
  urlHint: string
  minSeverity: Severity
  enabled: boolean
}

export type WebhookEvent = {
  employeeName: string
  breachName: string
  dataTypes: string[]
  severity: Severity
}

type ActiveWebhook = { url: string; minSeverity: Severity }

const SEVERITY_RANK: Record<Severity, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }

export function urlHint(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return "invalid-url"
  }
}

export function listWebhooks(companyId: string): Promise<WebhookRow[]> {
  return prisma.webhook.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, urlHint: true, minSeverity: true, enabled: true },
  })
}

async function post(url: string, event: WebhookEvent): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `${event.severity} exposure: ${event.employeeName} found in ${event.breachName}`,
        ...event,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export function sendTestWebhook(url: string): Promise<boolean> {
  return post(url, {
    employeeName: "Test User",
    breachName: "Test Breach",
    dataTypes: ["email"],
    severity: "LOW",
  })
}

export async function loadActiveWebhooks(companyId: string): Promise<ActiveWebhook[]> {
  const hooks = await prisma.webhook.findMany({
    where: { companyId, enabled: true },
    select: { encryptedUrl: true, minSeverity: true },
  })
  return hooks.map((h) => ({
    url: decryptConfig<{ url: string }>(h.encryptedUrl).url,
    minSeverity: h.minSeverity,
  }))
}

export async function dispatchWebhooks(hooks: ActiveWebhook[], event: WebhookEvent): Promise<void> {
  await Promise.all(
    hooks
      .filter((h) => SEVERITY_RANK[event.severity] >= SEVERITY_RANK[h.minSeverity])
      .map((h) => post(h.url, event))
  )
}
