import { Page, Text, View } from "@react-pdf/renderer"
import type { ReportData } from "../types"
import { longDate, riskColor, s, stamp } from "./theme"

// - Building blocks -
export function SectionHead({ title, lead }: { title: string; lead?: string }) {
  // Reserved space below keeps a page break from stranding the title without its content.
  return (
    <View wrap={false} minPresenceAhead={72}>
      <View style={s.sectionHead}>
        <View style={s.accent} />
        <Text style={s.h2}>{title}</Text>
      </View>
      {lead ? <Text style={s.lead}>{lead}</Text> : null}
    </View>
  )
}

export type Col = { label: string; flex: number; align?: "left" | "right" }

export function Table({ cols, rows }: { cols: Col[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return <Text style={s.empty}>No records for this period.</Text>
  return (
    <View style={s.table} wrap={rows.length > 16}>
      <View style={s.headRow}>
        {cols.map((c, i) => (
          <Text key={i} style={[s.headCell, { flex: c.flex, textAlign: c.align ?? "left" }]}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={[s.row, ri % 2 === 1 ? s.rowZebra : {}]} wrap={false}>
          {row.map((cell, ci) => (
            <Text key={ci} style={[s.cell, { flex: cols[ci]?.flex, textAlign: cols[ci]?.align ?? "left" }]}>
              {String(cell)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}

// - Cover page -
export function Cover({ d }: { d: ReportData }) {
  return (
    <Page size="A4" style={s.coverPage}>
      <View style={s.coverBand}>
        <View style={s.coverAccent} />
        <Text style={s.coverKicker}>SECURITY EXPOSURE REPORT</Text>
        <Text style={s.coverOrg}>{d.org.name}</Text>
        {d.org.domain ? <Text style={s.coverDomain}>{d.org.domain}</Text> : null}
      </View>
      <View style={s.coverBody}>
        <View style={s.metaTable}>
          <View style={s.metaRow}>
            <Text style={s.metaKey}>Reporting period</Text>
            <Text style={s.metaVal}>{d.deltas.windowLabel}</Text>
          </View>
          <View style={s.metaRow}>
            <Text style={s.metaKey}>Date generated</Text>
            <Text style={s.metaVal}>{longDate(d.generatedAt)}</Text>
          </View>
          <View style={s.metaRow}>
            <Text style={s.metaKey}>Overall risk score</Text>
            <Text style={[s.metaVal, { color: riskColor(d.exposure.riskScore) }]}>
              {`${d.exposure.riskScore} / 100  (${d.exposure.riskLabel})`}
            </Text>
          </View>
          <View style={s.metaRow}>
            <Text style={s.metaKey}>Classification</Text>
            <Text style={s.metaVal}>Confidential</Text>
          </View>
        </View>
      </View>
      <View style={s.coverFoot}>
        <View style={s.coverFootRule} />
        <Text style={s.coverFootText}>
          {`Confidential. This document contains security information intended solely for ${d.org.name}.`}
        </Text>
        <Text style={s.coverFootText}>{`Generated ${stamp(d.generatedAt)} by Gardik.`}</Text>
      </View>
    </Page>
  )
}
