import type { Severity } from "@prisma/client"
import type { WebhookEvent } from "@/lib/webhooks"

// Theme color per severity, shared by the rich channel payloads.
const SEVERITY_COLOR: Record<Severity, string> = {
  CRITICAL: "D32F2F",
  HIGH: "F57C00",
  MEDIUM: "FBC02D",
  LOW: "388E3C",
}

export function summaryLine(event: WebhookEvent): string {
  return `${event.severity} exposure: ${event.employeeName} found in ${event.breachName}`
}

function dataLine(event: WebhookEvent): string {
  return event.dataTypes.length ? event.dataTypes.join(", ") : "unknown data"
}

// Slack incoming-webhook payload. Slack renders `text` as the message body.
export function slackPayload(event: WebhookEvent) {
  return {
    text: `*${summaryLine(event)}*\nExposed data: ${dataLine(event)}`,
  }
}

// Microsoft Teams connector payload (legacy MessageCard, the format an
// "Incoming Webhook" connector accepts).
export function teamsPayload(event: WebhookEvent) {
  return {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    summary: summaryLine(event),
    themeColor: SEVERITY_COLOR[event.severity],
    title: `${event.severity} exposure detected`,
    sections: [
      {
        facts: [
          { name: "Employee", value: event.employeeName },
          { name: "Source", value: event.breachName },
          { name: "Exposed data", value: dataLine(event) },
        ],
      },
    ],
  }
}
