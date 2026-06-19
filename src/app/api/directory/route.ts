import { NextResponse } from "next/server"
import { requireAuth, requireAdmin } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { buildDirectoryConnection } from "@/lib/directory/validation"

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
  const result = buildDirectoryConnection(body)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: 400 })

  const { data, bearerToken } = result.built

  const connection = await prisma.directoryConnection.create({
    data: {
      companyId: session.user.companyId,
      ...data,
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
    { ...connection, ...(bearerToken ? { bearerToken } : {}) },
    { status: 201 }
  )
}
