import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateScim, checkScimRateLimit } from "@/lib/directory/scim-auth"

const SCHEMA_USER = "urn:ietf:params:scim:schemas:core:2.0:User"
const SCHEMA_LIST = "urn:ietf:params:scim:api:messages:2.0:ListResponse"
const MAX_PAGE = 200

type SCIMUser = {
  userName?: string
  name?: { givenName?: string; familyName?: string }
  emails?: { value: string; primary?: boolean }[]
  active?: boolean
}

function extractEmail(user: SCIMUser): string | null {
  const primary = user.emails?.find((e) => e.primary)?.value
  return (primary ?? user.emails?.[0]?.value ?? user.userName ?? null)?.toLowerCase() ?? null
}

// Extracts the value of `userName eq "..."` from the SCIM filter, the only
// filter an IdP emits while provisioning.
function parseUserNameFilter(filter: string | null): string | undefined {
  return filter?.match(/userName\s+eq\s+"([^"]+)"/i)?.[1]?.toLowerCase()
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params
  if (!(await checkScimRateLimit(connectionId)))
    return NextResponse.json({ status: 429, detail: "Too many requests" }, { status: 429 })
  const ctx = await authenticateScim(req, connectionId)
  if (!ctx) return NextResponse.json({ status: 401, detail: "Unauthorized" }, { status: 401 })

  const body = (await req.json()) as SCIMUser
  const email = extractEmail(body)
  if (!email) return NextResponse.json({ status: 400, detail: "No email found" }, { status: 400 })

  // A POST carrying active=false creates nothing: acknowledge with an empty body.
  if (body.active === false) return new NextResponse(null, { status: 204 })

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
    { schemas: [SCHEMA_USER], id: employee.id, userName: email },
    { status: 201 }
  )
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params
  if (!(await checkScimRateLimit(connectionId)))
    return NextResponse.json({ status: 429, detail: "Too many requests" }, { status: 429 })
  const ctx = await authenticateScim(req, connectionId)
  if (!ctx) return NextResponse.json({ status: 401, detail: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const email = parseUserNameFilter(url.searchParams.get("filter"))
  const startIndex = Math.max(1, parseInt(url.searchParams.get("startIndex") ?? "1", 10))
  const count = Math.min(MAX_PAGE, Math.max(0, parseInt(url.searchParams.get("count") ?? "100", 10)))

  // The filter has to be applied server-side, or the IdP's provisioning match breaks.
  const where = { companyId: ctx.companyId, ...(email ? { email } : {}) }

  const [totalResults, employees] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      select: { id: true, email: true, firstName: true, lastName: true },
      orderBy: { createdAt: "asc" },
      skip: startIndex - 1,
      take: count,
    }),
  ])

  const Resources = employees.map((e) => ({
    schemas: [SCHEMA_USER],
    id: e.id,
    userName: e.email,
    name: { givenName: e.firstName, familyName: e.lastName },
    emails: [{ value: e.email, primary: true }],
    active: true,
  }))

  return NextResponse.json({
    schemas: [SCHEMA_LIST],
    totalResults,
    startIndex,
    itemsPerPage: Resources.length,
    Resources,
  })
}
