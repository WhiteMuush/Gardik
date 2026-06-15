import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { requireAuth, requireAdmin } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { encryptConfig } from "@/lib/directory/crypto"
import type { DirectoryType } from "@prisma/client"

// Champs de configuration obligatoires par type de connexion (SCIM est généré côté serveur).
const REQUIRED_FIELDS: Record<string, string[]> = {
  AZURE_AD: ["tenantId", "clientId", "clientSecret"],
  GOOGLE_WORKSPACE: ["serviceAccountEmail", "privateKey", "delegatedAdminEmail", "domain"],
  LDAP: ["host", "port", "bindDN", "bindPassword", "baseDN"],
  AWS_DIRECTORY: ["accessKeyId", "secretAccessKey", "region", "identityStoreId"],
  OKTA: ["domain", "apiToken"],
  SCIM: [],
}

export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error

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
  const { session, error } = await requireAdmin()
  if (error) return error

  const body = await req.json()
  const { type, name, config } = body as {
    type: string
    name: string
    config?: Record<string, unknown>
  }

  if (!type || !name?.trim())
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  if (!(type in REQUIRED_FIELDS))
    return NextResponse.json({ error: `Invalid type: ${type}` }, { status: 400 })

  const missing = REQUIRED_FIELDS[type].filter((k) => !config?.[k])
  if (missing.length)
    return NextResponse.json(
      { error: `Missing config fields: ${missing.join(", ")}` },
      { status: 400 }
    )

  const isSCIM = type === "SCIM"
  const bearerToken = isSCIM ? randomUUID() : undefined
  const finalConfig = isSCIM ? { bearerToken } : (config ?? {})

  const connection = await prisma.directoryConnection.create({
    data: {
      companyId: session.user.companyId,
      type: type as DirectoryType,
      name: name.trim(),
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
