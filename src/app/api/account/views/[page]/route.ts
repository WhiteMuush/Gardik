import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { requireAuth } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { isViewPage, parseView, readViews, type ViewPage } from "@/lib/preferences/views"

type Context = { params: Promise<{ page: string }> }

async function writeView(userId: string, page: ViewPage, view: Record<string, string> | null) {
  const row = await prisma.userPreference.findUnique({ where: { userId }, select: { views: true } })
  const views = readViews(row?.views ?? null)
  if (view) views[page] = view
  else delete views[page]
  const data = views as Prisma.InputJsonObject
  await prisma.userPreference.upsert({
    where: { userId },
    create: { userId, views: data },
    update: { views: data },
  })
}

export async function PUT(req: Request, { params }: Context) {
  const { session, error } = await requireAuth()
  if (error) return error
  const { page } = await params
  if (!isViewPage(page)) return NextResponse.json({ error: "Unknown page" }, { status: 404 })

  const parsed = parseView(page, await req.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  await writeView(session.user.id, page, Object.keys(parsed.view).length > 0 ? parsed.view : null)
  return NextResponse.json({ view: parsed.view })
}

export async function DELETE(_req: Request, { params }: Context) {
  const { session, error } = await requireAuth()
  if (error) return error
  const { page } = await params
  if (!isViewPage(page)) return NextResponse.json({ error: "Unknown page" }, { status: 404 })

  await writeView(session.user.id, page, null)
  return NextResponse.json({ ok: true })
}
