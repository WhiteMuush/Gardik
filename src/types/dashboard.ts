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
}

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
