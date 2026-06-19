import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Liveness + DB readiness probe. Unauthenticated and side-effect free: it only
// confirms the process is up and can reach the database. No PII or secrets.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: "ok", db: "up" })
  } catch {
    return NextResponse.json({ status: "error", db: "down" }, { status: 503 })
  }
}
