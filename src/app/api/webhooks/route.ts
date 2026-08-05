import { NextResponse } from "next/server"
import { requireAuth, requirePermission } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { encryptConfig } from "@/lib/directory/crypto"
import { listWebhooks, urlHint } from "@/lib/webhooks"
import { isEmail } from "@/lib/validators"
import { parseOutboundUrl, resolvesToPublicHost } from "@/lib/ssrf"
import { NotificationChannel, Severity } from "@prisma/client"

// Resolve the encrypted delivery target and its display hint for a channel.
// EMAIL targets a recipient address; every other channel targets an HTTPS URL.
async function resolveTarget(
  channel: NotificationChannel,
  raw: string,
): Promise<{ target: string; hint: string } | { error: string }> {
  if (channel === "EMAIL") {
    const addr = raw.trim().toLowerCase()
    if (!isEmail(addr)) return { error: "Invalid email address" }
    return { target: addr, hint: addr }
  }
  const parsed = parseOutboundUrl(raw)
  if ("error" in parsed) return parsed
  // Refuse an endpoint that resolves inside the private space up front, rather
  // than storing it and discovering the problem on the first delivery.
  if (!(await resolvesToPublicHost(parsed.url.hostname))) {
    return { error: "URL must point to a public host" }
  }
  return { target: parsed.url.toString(), hint: urlHint(parsed.url.toString()) }
}

export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  return NextResponse.json(await listWebhooks(session.user.companyId))
}

export async function POST(req: Request) {
  const { session, error } = await requirePermission("notifications:manage")
  if (error) return error

  const { label, url, channel, minSeverity } = (await req.json()) as {
    label?: string
    url?: string
    channel?: string
    minSeverity?: string
  }

  if (!label?.trim()) return NextResponse.json({ error: "Missing label" }, { status: 400 })

  const chan =
    channel && channel in NotificationChannel
      ? (channel as NotificationChannel)
      : NotificationChannel.WEBHOOK

  const resolved = await resolveTarget(chan, url ?? "")
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: 400 })

  const severity =
    minSeverity && minSeverity in Severity ? (minSeverity as Severity) : Severity.MEDIUM

  const webhook = await prisma.webhook.create({
    data: {
      companyId: session.user.companyId,
      label: label.trim(),
      channel: chan,
      encryptedUrl: encryptConfig({ url: resolved.target }),
      urlHint: resolved.hint,
      minSeverity: severity,
    },
    select: { id: true, label: true, channel: true, urlHint: true, minSeverity: true, enabled: true },
  })
  return NextResponse.json(webhook, { status: 201 })
}
