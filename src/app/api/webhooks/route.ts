import { NextResponse } from "next/server"
import { requireAuth, requireAdmin } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { encryptConfig } from "@/lib/directory/crypto"
import { listWebhooks, urlHint } from "@/lib/webhooks"
import { isEmail } from "@/lib/validators"
import { NotificationChannel, Severity } from "@prisma/client"

// Resolve the encrypted delivery target and its display hint for a channel.
// EMAIL targets a recipient address; every other channel targets an HTTPS URL.
function resolveTarget(channel: NotificationChannel, raw: string): { target: string; hint: string } | { error: string } {
  if (channel === "EMAIL") {
    const addr = raw.trim().toLowerCase()
    if (!isEmail(addr)) return { error: "Invalid email address" }
    return { target: addr, hint: addr }
  }
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { error: "Invalid URL" }
  }
  if (parsed.protocol !== "https:") return { error: "URL must use https" }
  return { target: parsed.toString(), hint: urlHint(parsed.toString()) }
}

export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  return NextResponse.json(await listWebhooks(session.user.companyId))
}

export async function POST(req: Request) {
  const { session, error } = await requireAdmin()
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

  const resolved = resolveTarget(chan, url ?? "")
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
