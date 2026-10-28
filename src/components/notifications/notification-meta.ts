import type { WebhookRow } from "@/lib/webhooks"

export const CHANNELS: {
  id: WebhookRow["channel"]
  label: string
  target: string
  placeholder: string
}[] = [
  { id: "SLACK", label: "Slack", target: "Webhook URL", placeholder: "https://hooks.slack.com/..." },
  {
    id: "TEAMS",
    label: "Microsoft Teams",
    target: "Webhook URL",
    placeholder: "https://outlook.office.com/webhook/...",
  },
  { id: "EMAIL", label: "Email", target: "Email address", placeholder: "alerts@company.com" },
  { id: "WEBHOOK", label: "Webhook", target: "Endpoint URL", placeholder: "https://example.com/hook" },
]

// A channel receives alerts at or above its minimum severity, so the labels say so.
export const SEVERITIES: { id: WebhookRow["minSeverity"]; label: string }[] = [
  { id: "CRITICAL", label: "Critical only" },
  { id: "HIGH", label: "High and above" },
  { id: "MEDIUM", label: "Medium and above" },
  { id: "LOW", label: "All alerts" },
]

export const REPORT_SECTIONS = [
  { key: "exposure", label: "Exposure" },
  { key: "compliance", label: "Compliance" },
  { key: "datatypes", label: "Data types" },
  { key: "departments", label: "Departments" },
  { key: "employees", label: "Employees" },
  { key: "trends", label: "Trends" },
] as const

export const fieldClass =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}
