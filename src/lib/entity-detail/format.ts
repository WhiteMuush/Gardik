import type { RemediationAction } from "@prisma/client"

export type Field = { label: string; value: string | number }
export type Group = { heading?: string; fields: Field[] }
export type DetailResponse = {
  title: string
  subtitle?: string
  variant?: string
  tags?: string[]
  groups: Group[]
}

export const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })

export const prettyList = (xs: string[]) =>
  xs.length ? xs.map((x) => x.replace(/_/g, " ")).join(", ") : "None"

export const mfaLabel = (enabled: boolean | null) =>
  enabled == null ? "Unknown" : enabled ? "Enabled" : "Disabled"

export function remediationGroup(actions: RemediationAction[]): Group[] {
  if (actions.length === 0) return []
  return [
    {
      heading: "Remediation",
      fields: actions.map((a) => ({ label: `${a.action} (${a.status})`, value: fmtDate(a.createdAt) })),
    },
  ]
}
