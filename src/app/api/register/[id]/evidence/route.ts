import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/apiAuth"
import { listRegister, evidenceCsv } from "@/lib/register"

// Evidence pack (CSV) for one register entry, for an Article 33 dossier.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requirePermission("register:evidence")
  if (error) return error

  const { id } = await params
  const row = (await listRegister(session.user.companyId)).find((r) => r.id === id)
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return new NextResponse(evidenceCsv(row), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="exposure-${id}.csv"`,
    },
  })
}
