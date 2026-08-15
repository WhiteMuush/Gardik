const KEY = process.env.RESEND_API_KEY
const FROM = process.env.EMAIL_FROM
const APP_URL = process.env.AUTH_URL ?? "http://localhost:3000"

export function emailEnabled(): boolean {
  return Boolean(KEY && FROM)
}

type BreachAlert = {
  employeeName: string
  breachName: string
  dataTypes: string[]
  severity: string
}

function render(a: BreachAlert): string {
  const types = a.dataTypes.length ? a.dataTypes.join(", ") : "unknown data"
  return [
    `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#111;line-height:1.5">`,
    `<p><strong>${a.severity}</strong> exposure detected.</p>`,
    `<p>${a.employeeName} was found in the <strong>${a.breachName}</strong> breach.</p>`,
    `<p>Exposed data: ${types}.</p>`,
    `<p><a href="${APP_URL}/alerts">View the alert in DataShield</a></p>`,
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
        html: render(alert),
      }),
    })
  } catch {
    // Notification failures must never abort a scan.
  }
}

// The invitation link is the credential, so the body carries nothing else: no
// temporary password, no account details worth harvesting if the mailbox is
// later compromised, and an explicit expiry so a stale link found months later
// is obviously stale.
export async function sendInvitation(
  recipient: string,
  link: string,
  expiresAt: Date
): Promise<boolean> {
  const html = [
    `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#111;line-height:1.5">`,
    `<p>You have been given access to DataShield.</p>`,
    `<p><a href="${link}">Choose your password</a> to activate the account.</p>`,
    `<p>This link works once and stops working on ${expiresAt.toUTCString()}.</p>`,
    `<p>If you were not expecting this, ignore the message: nothing changes until the link is used.</p>`,
    `</div>`,
  ].join("")
  return sendEmail([recipient], "Your DataShield account", html)
}

export type EmailAttachment = { filename: string; content: string } // content: base64

// Generic transactional send (HTML body plus optional attachments). Returns
// whether it was dispatched; never throws so a scheduled job is not aborted.
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
