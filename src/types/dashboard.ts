export type GridItemLayout = {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
}

export type WidgetMeta = {
  instanceId: string
  title: string | null
  visible: boolean
  // Provider id scoping a breach widget to one tool; absent means all providers, and other widgets ignore it.
  source?: string | null
}

// Breach-derived widgets that can be scoped to one provider; the others ignore the source filter.
export const SOURCE_FILTERABLE_WIDGETS = new Set([
  "trend-chart",
  "breach-sources",
  "breach-source-donut",
  "breach-timeline",
  "top-breaches",
  "data-type-breakdown",
  "data-type-radar",
])

export type SavedDashboardConfig = {
  layout: GridItemLayout[]
  widgets: WidgetMeta[]
}

export type PresetScope = "PERSONAL" | "COMPANY"

export type DashboardPreset = {
  id: string
  name: string
  scope: PresetScope
  layout: GridItemLayout[]
  widgets: WidgetMeta[]
  userId: string | null
  companyId: string
  createdAt: string
  updatedAt: string
}
