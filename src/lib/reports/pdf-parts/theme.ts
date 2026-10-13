import { StyleSheet } from "@react-pdf/renderer"
import type { FindingSeverity } from "../types"

// - Palette (Gardik brand: violet primary, orange accent, warm cream) -
export const C = {
  brand: "#7F27FF", // primary violet
  brandDark: "#1B1037", // deep violet (cover band, headings)
  brandSoft: "#C4A8FF", // light violet (on dark)
  orange: "#FF8911", // accent
  cream: "#FFF5E5", // warm page background
  ink: "#18122B",
  body: "#2B2440",
  muted: "#6B6480",
  faint: "#9A93AD",
  border: "#E7E0F0",
  zebra: "#FAF7FF",
  head: "#F3EDFF",
  white: "#ffffff",
}

// Severity colours mirror the app's --severity-* tokens (oklch) as hex.
export const SEVERITY: Record<FindingSeverity, string> = {
  critical: "#E03131",
  high: "#FF8911",
  medium: "#E8A20C",
  info: "#7F27FF",
  ok: "#1FA45B",
}

export function riskColor(score: number): string {
  if (score >= 76) return SEVERITY.critical
  if (score >= 51) return SEVERITY.high
  if (score >= 26) return SEVERITY.medium
  return SEVERITY.ok
}

// - Formatting helpers -
const nf = new Intl.NumberFormat("en-US")
export const num = (v: number) => nf.format(v)
export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
export const were = (n: number) => (n === 1 ? "was" : "were")

export function longDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d)
}
export const stamp = (iso: string) => new Date(iso).toUTCString()

// - Styles -
export const s = StyleSheet.create({
  // Cover page
  coverPage: { fontFamily: "Helvetica", color: C.ink, backgroundColor: C.cream },
  coverBand: { backgroundColor: C.brandDark, paddingHorizontal: 48, paddingTop: 70, paddingBottom: 44 },
  coverAccent: { width: 46, height: 4, backgroundColor: C.orange, borderRadius: 2, marginBottom: 18 },
  coverKicker: { fontSize: 10, color: C.brandSoft, fontFamily: "Helvetica-Bold", letterSpacing: 3 },
  coverOrg: { fontSize: 30, color: C.white, fontFamily: "Helvetica-Bold", marginTop: 12, lineHeight: 1.1 },
  coverDomain: { fontSize: 12, color: C.brandSoft, marginTop: 8 },
  coverBody: { paddingHorizontal: 48, paddingTop: 40, flexGrow: 1 },
  metaTable: { borderTopWidth: 1, borderTopColor: C.border },
  metaRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 10 },
  metaKey: { width: 160, fontSize: 9.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  metaVal: { flex: 1, fontSize: 11, color: C.ink, fontFamily: "Helvetica-Bold" },
  coverFoot: { paddingHorizontal: 48, paddingBottom: 40 },
  coverFootText: { fontSize: 8.5, color: C.muted, lineHeight: 1.5 },
  coverFootRule: { borderTopWidth: 2, borderTopColor: C.brand, width: 60, marginBottom: 10 },

  // Content pages
  page: {
    paddingTop: 60,
    paddingBottom: 54,
    paddingHorizontal: 48,
    fontSize: 10,
    color: C.body,
    fontFamily: "Helvetica",
  },
  runHead: {
    position: "absolute",
    top: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 6,
  },
  runHeadOrg: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.brandDark },
  runHeadDoc: { fontSize: 8.5, color: C.muted },

  section: { marginTop: 18 },
  sectionHead: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  accent: { width: 3, height: 13, backgroundColor: C.brand, marginRight: 8, borderRadius: 2 },
  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.brandDark },
  lead: { fontSize: 9, color: C.muted, marginBottom: 6 },

  // Narrative prose
  para: { fontSize: 10, lineHeight: 1.5, color: C.body, marginBottom: 6, textAlign: "justify" },
  strong: { fontFamily: "Helvetica-Bold", color: C.ink },

  // Findings
  finding: { flexDirection: "row", alignItems: "flex-start", marginBottom: 5 },
  findingText: { flex: 1, fontSize: 10, lineHeight: 1.4 },
  badge: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    borderRadius: 2,
    paddingVertical: 1.5,
    paddingHorizontal: 5,
    marginRight: 8,
    marginTop: 1,
    textTransform: "uppercase",
  },

  // Tables
  table: { borderWidth: 1, borderColor: C.border, borderRadius: 4 },
  headRow: { flexDirection: "row", backgroundColor: C.head },
  row: { flexDirection: "row", borderTopWidth: 1, borderTopColor: C.border },
  rowZebra: { backgroundColor: C.zebra },
  headCell: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: C.brandDark,
  },
  cell: { paddingVertical: 5, paddingHorizontal: 6, fontSize: 8.5, color: C.body },
  empty: { fontSize: 9, color: C.faint },

  // Footer
  footer: {
    position: "absolute",
    bottom: 26,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 6,
  },
  footText: { fontSize: 7.5, color: C.faint },
})
