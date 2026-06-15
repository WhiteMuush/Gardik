import { NextResponse } from "next/server"
import { requireAuth, requireAdmin } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { encryptConfig } from "@/lib/directory/crypto"
import { listWebhooks, urlHint } from "@/lib/webhooks"
import { Severity } from "@prisma/client"

export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  return NextResponse.json(await listWebhooks(session.user.companyId))
}

export async function POST(req: Request) {
  const { session, error } = await requireAdmin()
  if (error) return error

  const { label, url, minSeverity } = (await req.json()) as {
    label?: string
    url?: string
    minSeverity?: string
  }

  if (!label?.trim()) return NextResponse.json({ error: "Missing label" }, { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(url ?? "")
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }
  if (parsed.protocol !== "https:")
    return NextResponse.json({ error: "URL must use https" }, { status: 400 })

  const severity =
    minSeverity && minSeverity in Severity ? (minSeverity as Severity) : Severity.MEDIUM

  const webhook = await prisma.webhook.create({
    data: {
      companyId: session.user.companyId,
      label: label.trim(),
      encryptedUrl: encryptConfig({ url: parsed.toString() }),
      urlHint: urlHint(parsed.toString()),
      minSeverity: severity,
    },
    select: { id: true, label: true, urlHint: true, minSeverity: true, enabled: true },
  })
  return NextResponse.json(webhook, { status: 201 })
}
