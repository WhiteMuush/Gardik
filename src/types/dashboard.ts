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
  // Provider id (ApiProvider) scoping a source-filterable widget to a single
  // intelligence tool. Undefined / absent means "all providers". Ignored by
  // widgets that are not breach-centric (see SOURCE_FILTERABLE_WIDGETS).
  source?: string | null
}

// Widget types whose data is derived from breach intelligence and can therefore
// be scoped to a single provider. Other widgets (alerts workflow, directory,
// MFA) ignore the source filter.
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
