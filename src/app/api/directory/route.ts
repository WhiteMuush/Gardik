import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { encryptConfig } from "@/lib/directory/crypto"
import type { AzureADConfig, GoogleWorkspaceConfig, LDAPConfig } from "@/lib/directory/types"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const connections = await prisma.directoryConnection.findMany({
    where: { companyId: session.user.companyId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      name: true,
      status: true,
      lastSyncAt: true,
      lastSyncCount: true,
      errorMessage: true,
      createdAt: true,
    },
  })

  return NextResponse.json(connections)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Admin only" }, { status: 403 })

  const body = await req.json()
  const { type, name, config } = body as {
    type: string
    name: string
    config: AzureADConfig | GoogleWorkspaceConfig | LDAPConfig
  }

  if (!type || !name || !config)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })

  const connection = await prisma.directoryConnection.create({
    data: {
      companyId: session.user.companyId,
      type: type as "AZURE_AD" | "GOOGLE_WORKSPACE" | "LDAP",
      name,
      encryptedConfig: encryptConfig(config),
      status: "PENDING",
    },
    select: {
      id: true,
      type: true,
      name: true,
      status: true,
      lastSyncAt: true,
      lastSyncCount: true,
      errorMessage: true,
      createdAt: true,
    },
  })

  return NextResponse.json(connection, { status: 201 })
}
