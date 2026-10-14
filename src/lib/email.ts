import { appBaseUrl } from "@/lib/appUrl"

const KEY = process.env.RESEND_API_KEY
const FROM = process.env.EMAIL_FROM

export function emailEnabled(): boolean {
  return Boolean(KEY && FROM)
}

type BreachAlert = {
  employeeName: string
  breachName: string
  dataTypes: string[]
  severity: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// Values come from external sources, so each one is escaped before reaching the HTML.
export function breachAlertHtml(a: BreachAlert): string {
  const types = a.dataTypes.length ? a.dataTypes.map(escapeHtml).join(", ") : "unknown data"
  return [
    `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#111;line-height:1.5">`,
    `<p><strong>${escapeHtml(a.severity)}</strong> exposure detected.</p>`,
    `<p>${escapeHtml(a.employeeName)} was found in the <strong>${escapeHtml(a.breachName)}</strong> breach.</p>`,
    `<p>Exposed data: ${types}.</p>`,
    `<p><a href="${appBaseUrl()}/alerts">View the alert in Gardik</a></p>`,
    `</div>`,
  ].join("")
}

export async function sendBreachAlert(recipients: string[], alert: BreachAlert): Promise<void> {
  if (!emailEnabled() || recipients.length === 0) return
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: recipients,
        subject: `New breach exposure: ${alert.employeeName}`,
        html: breachAlertHtml(alert),
      }),
    })
  } catch {
    // Notification failures must never abort a scan.
  }
}

// The link is the credential, so the body carries nothing else to harvest and states its expiry.
export async function sendInvitation(recipient: string, link: string, expiresAt: Date): Promise<boolean> {
  const html = [
    `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#111;line-height:1.5">`,
    `<p>You have been given access to Gardik.</p>`,
    `<p><a href="${link}">Choose your password</a> to activate the account.</p>`,
    `<p>This link works once and stops working on ${expiresAt.toUTCString()}.</p>`,
    `<p>If you were not expecting this, ignore the message: nothing changes until the link is used.</p>`,
    `</div>`,
  ].join("")
  return sendEmail([recipient], "Your Gardik account", html)
}

export type EmailAttachment = { filename: string; content: string } // content: base64

// Never throws, so a scheduled job is not aborted; returns whether it was dispatched.
export async function sendEmail(
  recipients: string[],
  subject: string,
  html: string,
  attachments: EmailAttachment[] = []
): Promise<boolean> {
  if (!emailEnabled() || recipients.length === 0) return false
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: recipients, subject, html, attachments }),
    })
    return res.ok
  } catch {
    return false
  }
}
