import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer"
import type { ReportData } from "./types"
import type { ReportSection } from "./html"
import { s } from "./pdf-parts/theme"
import { Cover } from "./pdf-parts/blocks"
import {
  AlertBreakdown,
  ExecutiveOverview,
  KeyFindings,
  NotableIncidents,
  PeriodActivity,
} from "./pdf-parts/narrative"
import { DetailSection } from "./pdf-parts/details"

const SECTION_ORDER: ReportSection[] = [
  "exposure",
  "compliance",
  "datatypes",
  "departments",
  "employees",
  "trends",
]

// Renders the cover page, the narrative sections and the requested detail tables into a PDF buffer.
export function reportPdf(sections: ReportSection[], data: ReportData): Promise<Buffer> {
  const want = new Set(sections)
  const details = SECTION_ORDER.filter((sec) => want.has(sec))

  const doc = (
    <Document title={`Gardik report - ${data.org.name}`} author="Gardik" subject="Security exposure report">
      <Cover d={data} />

      <Page size="A4" style={s.page}>
        <View style={s.runHead} fixed>
          <Text style={s.runHeadOrg}>{data.org.name}</Text>
          <Text style={s.runHeadDoc}>Security Exposure Report</Text>
        </View>

        <ExecutiveOverview d={data} />
        <KeyFindings findings={data.findings} />
        <PeriodActivity d={data} />
        <NotableIncidents d={data} />
        <AlertBreakdown d={data} />

        {details.map((sec) => (
          <DetailSection key={sec} section={sec} d={data} />
        ))}

        <View style={s.footer} fixed>
          <Text style={s.footText}>{`${data.org.name} - confidential`}</Text>
          <Text
            style={s.footText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )

  return renderToBuffer(doc)
}
