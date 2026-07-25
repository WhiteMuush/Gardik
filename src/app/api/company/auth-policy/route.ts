import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { AuthMethod } from "@prisma/client"

const METHODS = new Set<string>(Object.values(AuthMethod))

export async function PATCH(req: Request) {
  const { session, error } = await requirePermission("policy:manage")
  if (error) return error

  const body = (await req.json()) as {
    require2fa?: boolean
    allowedAuthMethods?: string[]
  }

  const data: { require2fa?: boolean; allowedAuthMethods?: AuthMethod[] } = {}

  if (typeof body.require2fa === "boolean") data.require2fa = body.require2fa

  if (body.allowedAuthMethods) {
    if (body.allowedAuthMethods.length === 0) {
      return NextResponse.json({ error: "At least one method required" }, { status: 400 })
    }
    if (!body.allowedAuthMethods.every((m) => METHODS.has(m))) {
      return NextResponse.json({ error: "Unknown method" }, { status: 400 })
    }
    data.allowedAuthMethods = body.allowedAuthMethods as AuthMethod[]
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  await prisma.company.update({ where: { id: session.user.companyId }, data })
  return NextResponse.json({ ok: true })
}
