import { prisma } from "@/lib/prisma"
import { parseOutboundUrl, resolvesToPublicHost } from "@/lib/ssrf"
import { decryptConfig } from "@/lib/directory/crypto"
import { emailEnabled, sendBreachAlert } from "@/lib/email"
import { slackPayload, summaryLine, teamsPayload } from "@/lib/notify/payloads"
import type { NotificationChannel, Severity } from "@prisma/client"

export type WebhookRow = {
  id: string
  label: string
  channel: NotificationChannel
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

type ActiveWebhook = { channel: NotificationChannel; target: string; minSeverity: Severity }

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
    select: { id: true, label: true, channel: true, urlHint: true, minSeverity: true, enabled: true },
  })
}

async function postJson(url: string, body: unknown): Promise<boolean> {
  // Re-checked at delivery, not only when the row was written: DNS can be
  // repointed into the private space long after an endpoint was accepted.
  const parsed = parseOutboundUrl(url)
  if ("error" in parsed) return false
  if (!(await resolvesToPublicHost(parsed.url.hostname))) return false

  try {
    const res = await fetch(url, {
      redirect: "error",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return res.ok
  } catch {
    return false
  }
}

// Deliver one event through a single channel, formatting the payload for the
// destination. Never throws: a failed notification must not abort a scan.
export async function deliver(
  channel: NotificationChannel,
  target: string,
  event: WebhookEvent
): Promise<boolean> {
  switch (channel) {
    case "SLACK":
      return postJson(target, slackPayload(event))
    case "TEAMS":
      return postJson(target, teamsPayload(event))
    case "EMAIL":
      await sendBreachAlert([target], event)
      return emailEnabled()
    case "WEBHOOK":
      return postJson(target, { text: summaryLine(event), ...event })
  }
}

const TEST_EVENT: WebhookEvent = {
  employeeName: "Test User",
  breachName: "Test Breach",
  dataTypes: ["email"],
  severity: "LOW",
}

export function sendTest(channel: NotificationChannel, target: string): Promise<boolean> {
  return deliver(channel, target, TEST_EVENT)
}

export async function loadActiveWebhooks(companyId: string): Promise<ActiveWebhook[]> {
  const hooks = await prisma.webhook.findMany({
    where: { companyId, enabled: true },
    select: { encryptedUrl: true, channel: true, minSeverity: true },
  })
  return hooks.map((h) => ({
    channel: h.channel,
    target: decryptConfig<{ url: string }>(h.encryptedUrl).url,
    minSeverity: h.minSeverity,
  }))
}

export async function dispatchWebhooks(hooks: ActiveWebhook[], event: WebhookEvent): Promise<void> {
  await Promise.all(
    hooks
      .filter((h) => SEVERITY_RANK[event.severity] >= SEVERITY_RANK[h.minSeverity])
      .map((h) => deliver(h.channel, h.target, event))
  )
}
