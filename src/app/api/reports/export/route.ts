import { requirePermission } from "@/lib/apiAuth"
import { rateLimit } from "@/lib/rateLimit"
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

// Filename-safe slug: strip accents, keep alphanumerics, collapse the rest to
// single hyphens. Keeps downloads readable and portable across filesystems.
function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
}

// e.g. datashield_acme-corp_report_2026-06-25 or
//      datashield_acme-corp_employees_2026-06-25
function reportFilename(orgName: string, generatedAt: string, part: string): string {
  const company = slug(orgName) || "report"
  const date = generatedAt.slice(0, 10)
  return `datashield_${company}_${part}_${date}`
}

export async function GET(request: Request): Promise<Response> {
  const { session, error } = await requirePermission("reports:export")
  if (error) return error

  // Rendering a PDF walks the whole company's data and costs real CPU, so it
  // gets a tighter ceiling than an ordinary read.
  if (!(await rateLimit(`report-export:${session.user.companyId}`, 10, 60_000))) {
    return new Response(JSON.stringify({ error: "Too many exports" }), {
      status: 429,
      headers: { "content-type": "application/json" },
    })
  }

  const sp = new URL(request.url).searchParams
  const section = sp.get("section") ?? "all"
  if (!isSection(section)) return new Response("Invalid section", { status: 400 })

  const filters = parseReportFilters(sp)
  const data = await getReportData(session.user.companyId, filters)

  if (sp.get("format") === "pdf") {
    const pdf = await reportPdf(PDF_SECTIONS, data)
    const name = reportFilename(data.org.name, data.generatedAt, "report")
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}.pdf"`,
      },
    })
  }

  const csv = reportCsv(section, data)
  const name = reportFilename(data.org.name, data.generatedAt, section)
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.csv"`,
    },
  })
}
