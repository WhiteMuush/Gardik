import { auth } from "@/auth"
import { getReportData } from "@/lib/reports"
import { parseReportFilters } from "@/lib/reports/filters"
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
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })

  const sp = new URL(request.url).searchParams
  const section = sp.get("section") ?? "all"
  if (!isSection(section)) return new Response("Invalid section", { status: 400 })

  const filters = parseReportFilters(sp)
  const data = await getReportData(session.user.companyId, filters)
  const csv = reportCsv(section, data)

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="datashield-report-${section}.csv"`,
    },
  })
}
