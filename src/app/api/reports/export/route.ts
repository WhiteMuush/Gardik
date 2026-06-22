import { requireAuth } from "@/lib/apiAuth"
import { getReportData } from "@/lib/reports"
import { parseReportFilters } from "@/lib/reports/filters"
import { reportCsv, type CsvSection } from "@/lib/reports/csv"
import { reportPdf } from "@/lib/reports/pdf"
import type { ReportSection } from "@/lib/reports/html"

const SECTIONS: CsvSection[] = [
  "all",
  "exposure",
  "datatypes",
  "departments",
  "employees",
  "trends",
  "compliance",
]

const PDF_SECTIONS: ReportSection[] = [
  "exposure",
  "compliance",
  "datatypes",
  "departments",
  "employees",
  "trends",
]

function isSection(value: string): value is CsvSection {
  return (SECTIONS as string[]).includes(value)
}

export async function GET(request: Request): Promise<Response> {
  const { session, error } = await requireAuth()
  if (error) return error

  const sp = new URL(request.url).searchParams
  const section = sp.get("section") ?? "all"
  if (!isSection(section)) return new Response("Invalid section", { status: 400 })

  const filters = parseReportFilters(sp)
  const data = await getReportData(session.user.companyId, filters)

  if (sp.get("format") === "pdf") {
    const pdf = await reportPdf(PDF_SECTIONS, data)
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="datashield-report.pdf"`,
      },
    })
  }

  const csv = reportCsv(section, data)
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="datashield-report-${section}.csv"`,
    },
  })
}
