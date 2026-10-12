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

// Slack and Teams read "<...>" as mentions and links; escaping & < > is the
// documented way to keep text literal.
function escapeControls(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// Breach names and data types come from external sources, some of them dark
// web aggregators. Inline code never renders as a link or formatting;
// backticks are swapped so a value cannot close the span early, and line
// breaks would split the span.
function untrusted(value: string): string {
  return "`" + escapeControls(value.replace(/`/g, "'").replace(/\r\n|\r|\n/g, " ")) + "`"
}

function dataLine(event: WebhookEvent): string {
  return event.dataTypes.length ? untrusted(event.dataTypes.join(", ")) : "unknown data"
}

// Slack incoming-webhook payload. Slack renders `text` as the message body.
export function slackPayload(event: WebhookEvent) {
  const employee = escapeControls(event.employeeName)
  return {
    text: `*${event.severity} exposure: ${employee} found in ${untrusted(event.breachName)}*\nExposed data: ${dataLine(event)}`,
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
          { name: "Employee", value: escapeControls(event.employeeName) },
          { name: "Source", value: untrusted(event.breachName) },
          { name: "Exposed data", value: dataLine(event) },
        ],
      },
    ],
  }
}
