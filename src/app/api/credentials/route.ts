import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { encryptConfig } from "@/lib/directory/crypto"
import { keyHint } from "@/lib/credentials/service"
import { PROVIDER_IDS, providerMeta } from "@/lib/credentials/providers"
import type { ApiProvider } from "@prisma/client"

const SELECT = {
  id: true,
  provider: true,
  label: true,
  status: true,
  keyHint: true,
  lastUsedAt: true,
  createdAt: true,
} as const

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const credentials = await prisma.apiCredential.findMany({
    where: { companyId: session.user.companyId },
    orderBy: { provider: "asc" },
    select: SELECT,
  })
  return NextResponse.json(credentials)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Admin only" }, { status: 403 })

  const { provider, key } = (await req.json()) as { provider?: string; key?: string }
  if (!provider || !PROVIDER_IDS.has(provider as ApiProvider))
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 })
  if (!key?.trim()) return NextResponse.json({ error: "Missing key" }, { status: 400 })

  const trimmed = key.trim()
  const label = providerMeta(provider as ApiProvider)!.label
  const encrypted = encryptConfig({ key: trimmed })

  const credential = await prisma.apiCredential.upsert({
    where: {
      companyId_provider: {
        companyId: session.user.companyId,
        provider: provider as ApiProvider,
      },
    },
    update: { encryptedKey: encrypted, keyHint: keyHint(trimmed), status: "ACTIVE" },
    create: {
      companyId: session.user.companyId,
      provider: provider as ApiProvider,
      label,
      encryptedKey: encrypted,
      keyHint: keyHint(trimmed),
      status: "ACTIVE",
    },
    select: SELECT,
  })
  return NextResponse.json(credential, { status: 201 })
}
