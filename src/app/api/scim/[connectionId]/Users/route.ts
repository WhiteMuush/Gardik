import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { decryptConfig } from "@/lib/directory/crypto"
import type { SCIMConfig } from "@/lib/directory/types"

type SCIMUser = {
  userName?: string
  name?: { givenName?: string; familyName?: string }
  emails?: { value: string; primary?: boolean }[]
  active?: boolean
}

async function authenticate(
  req: Request,
  connectionId: string
): Promise<{ companyId: string } | null> {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.replace(/^Bearer\s+/i, "")
  if (!token) return null

  const conn = await prisma.directoryConnection.findFirst({
    where: { id: connectionId, type: "SCIM" },
    select: { encryptedConfig: true, companyId: true },
  })
  if (!conn) return null

  const config = decryptConfig<SCIMConfig>(conn.encryptedConfig)
  if (config.bearerToken !== token) return null

  return { companyId: conn.companyId }
}

function extractEmail(user: SCIMUser): string | null {
  const primary = user.emails?.find((e) => e.primary)?.value
  const first = user.emails?.[0]?.value
  return (primary ?? first ?? user.userName ?? null)?.toLowerCase() ?? null
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params
  const ctx = await authenticate(req, connectionId)
  if (!ctx) return NextResponse.json({ status: 401, detail: "Unauthorized" }, { status: 401 })

  const body = (await req.json()) as SCIMUser
  const email = extractEmail(body)
  if (!email) return NextResponse.json({ status: 400, detail: "No email found" }, { status: 400 })

  if (body.active === false) {
    return NextResponse.json({ status: 204 }, { status: 204 })
  }

  const employee = await prisma.employee.upsert({
    where: { email_companyId: { email, companyId: ctx.companyId } },
    update: {
      firstName: body.name?.givenName ?? undefined,
      lastName: body.name?.familyName ?? undefined,
    },
    create: {
      email,
      firstName: body.name?.givenName ?? "",
      lastName: body.name?.familyName ?? "",
      companyId: ctx.companyId,
    },
  })

  await prisma.directoryConnection.update({
    where: { id: connectionId },
    data: { status: "ACTIVE", lastSyncAt: new Date() },
  })

  return NextResponse.json(
    { schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"], id: employee.id, userName: email },
    { status: 201 }
  )
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params
  const ctx = await authenticate(req, connectionId)
  if (!ctx) return NextResponse.json({ status: 401, detail: "Unauthorized" }, { status: 401 })

  const employees = await prisma.employee.findMany({
    where: { companyId: ctx.companyId },
    select: { id: true, email: true, firstName: true, lastName: true },
  })

  const resources = employees.map((e) => ({
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: e.id,
    userName: e.email,
    name: { givenName: e.firstName, familyName: e.lastName },
    emails: [{ value: e.email, primary: true }],
    active: true,
  }))

  return NextResponse.json({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: resources.length,
    Resources: resources,
  })
}
