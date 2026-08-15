import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import type { SavedDashboardConfig } from "@/types/dashboard"

export async function GET() {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 })

  const config = await prisma.dashboardConfig.findUnique({
    where: { userId: session.user.id },
  })

  if (!config) return NextResponse.json(null)

  return NextResponse.json({
    layout: config.layout as SavedDashboardConfig["layout"],
    widgets: config.widgets as SavedDashboardConfig["widgets"],
  } satisfies SavedDashboardConfig)
}

export async function PUT(req: Request) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 })

  const body: SavedDashboardConfig = await req.json()

  await prisma.dashboardConfig.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      layout: body.layout,
      widgets: body.widgets,
    },
    update: {
      layout: body.layout,
      widgets: body.widgets,
    },
  })

  return NextResponse.json({ ok: true })
}
