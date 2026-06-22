import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { decryptConfig } from "@/lib/directory/crypto"
import { sendTest } from "@/lib/webhooks"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const webhook = await prisma.webhook.findFirst({
    where: { id, companyId: session.user.companyId },
    select: { encryptedUrl: true, channel: true },
  })
  if (!webhook) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const target = decryptConfig<{ url: string }>(webhook.encryptedUrl).url
  const delivered = await sendTest(webhook.channel, target)
  return NextResponse.json({ delivered })
}
