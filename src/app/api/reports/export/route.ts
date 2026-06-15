import { requireAuth } from "@/lib/apiAuth"
import { getReportData } from "@/lib/reports"
import { reportCsv, type CsvSection } from "@/lib/reports/csv"

const SECTIONS: CsvSection[] = [
  "all",
  "exposure",
  "datatypes",
  "departments",
  "employees",
  "trends",
  "compliance",
]

function isSection(value: string): value is CsvSection {
  return (SECTIONS as string[]).includes(value)
}

export async function GET(request: Request): Promise<Response> {
  const { session, error } = await requireAuth()
  if (error) return error

  const section = new URL(request.url).searchParams.get("section") ?? "all"
  if (!isSection(section)) return new Response("Invalid section", { status: 400 })

  const data = await getReportData(session.user.companyId)
  const csv = reportCsv(section, data)

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="datashield-report-${section}.csv"`,
    },
  })
}
