import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { encryptConfig } from "@/lib/directory/crypto"
import type { DirectoryType } from "@prisma/client"

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
  const { type, name, config } = body as { type: string; name: string; config: Record<string, unknown> }

  if (!type || !name) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

  const isSCIM = type === "SCIM"
  const bearerToken = isSCIM ? randomUUID() : undefined
  const finalConfig = isSCIM ? { bearerToken } : (config ?? {})

  const connection = await prisma.directoryConnection.create({
    data: {
      companyId: session.user.companyId,
      type: type as DirectoryType,
      name,
      encryptedConfig: encryptConfig(finalConfig),
      status: isSCIM ? "ACTIVE" : "PENDING",
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

  return NextResponse.json(
    { ...connection, ...(isSCIM ? { bearerToken } : {}) },
    { status: 201 }
  )
}
