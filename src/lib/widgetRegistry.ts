export type WidgetCategory = "overview" | "alerts" | "breaches" | "employees" | "trends"

export type WidgetDef = {
  type: string
  defaultTitle: string
  description: string
  defaultSize: { w: number; h: number }
  minSize: { w: number; h: number }
  category: WidgetCategory
  defaultVisible?: boolean
}

const WIDGETS: WidgetDef[] = [
  // ── Existing widgets ────────────────────────────────────────────
  {
    type: "stats-row",
    defaultTitle: "Key Metrics",
    description: "KPI cards: employees at risk, active alerts, new detections, risk score",
    defaultSize: { w: 12, h: 4 },
    minSize: { w: 6, h: 3 },
    category: "overview",
  },
  {
    type: "trend-chart",
    defaultTitle: "Incident Timeline",
    description: "Area chart showing breach detections over the last 12 months",
    defaultSize: { w: 8, h: 6 },
    minSize: { w: 4, h: 5 },
    category: "trends",
  },
  {
    type: "data-type-breakdown",
    defaultTitle: "Exposed Data Types",
    description: "Bar chart of compromised data categories (passwords, emails, SSN…)",
    defaultSize: { w: 4, h: 6 },
    minSize: { w: 3, h: 4 },
    category: "breaches",
  },
  {
    type: "breach-sources",
    defaultTitle: "Breach Sources",
    description: "List of sites that exposed company employee data with affected counts",
    defaultSize: { w: 5, h: 7 },
    minSize: { w: 3, h: 4 },
    category: "breaches",
  },
  {
    type: "severity-donut",
    defaultTitle: "Alert Severity",
    description: "Donut chart showing open alert distribution by severity level",
    defaultSize: { w: 3, h: 6 },
    minSize: { w: 2, h: 4 },
    category: "alerts",
  },
  {
    type: "department-risk",
    defaultTitle: "Department Exposure",
    description: "Horizontal bar chart of compromised employees by department",
    defaultSize: { w: 4, h: 6 },
    minSize: { w: 3, h: 4 },
    category: "employees",
  },
  {
    type: "alerts-feed",
    defaultTitle: "Recent Alerts",
    description: "Live feed of the latest security alerts with status filters",
    defaultSize: { w: 4, h: 7 },
    minSize: { w: 3, h: 4 },
    category: "alerts",
  },
  {
    type: "top-risky-employees",
    defaultTitle: "Top Employees at Risk",
    description: "Ranked list of employees with the highest risk scores",
    defaultSize: { w: 4, h: 7 },
    minSize: { w: 3, h: 4 },
    category: "employees",
  },
  // ── New widgets ─────────────────────────────────────────────────
  {
    type: "risk-gauge",
    defaultTitle: "Risk Score",
    description: "Semi-circle gauge showing the company's overall security risk score (0–100)",
    defaultSize: { w: 3, h: 5 },
    minSize: { w: 2, h: 4 },
    category: "overview",
    defaultVisible: false,
  },
  {
    type: "alert-status-breakdown",
    defaultTitle: "Alert Status",
    description: "Progress bars showing OPEN / ACKNOWLEDGED / RESOLVED alert distribution",
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    category: "alerts",
    defaultVisible: false,
  },
  {
    type: "employee-exposure",
    defaultTitle: "Employee Exposure",
    description: "3-tier breakdown: clean employees vs. 1 breach vs. multiple breaches",
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    category: "employees",
    defaultVisible: false,
  },
  {
    type: "alerts-by-month",
    defaultTitle: "Alerts by Month",
    description: "Stacked bar chart of monthly alert volume by severity level",
    defaultSize: { w: 7, h: 7 },
    minSize: { w: 4, h: 5 },
    category: "trends",
    defaultVisible: false,
  },
  {
    type: "alert-velocity",
    defaultTitle: "Alert Velocity",
    description: "Line chart of daily alert creation over the last 30 days",
    defaultSize: { w: 5, h: 6 },
    minSize: { w: 3, h: 4 },
    category: "trends",
    defaultVisible: false,
  },
  {
    type: "critical-alerts",
    defaultTitle: "Urgent Alerts",
    description: "Filtered list of only CRITICAL and HIGH open alerts requiring immediate action",
    defaultSize: { w: 5, h: 7 },
    minSize: { w: 3, h: 4 },
    category: "alerts",
    defaultVisible: false,
  },
  {
    type: "alerts-by-department",
    defaultTitle: "Alerts by Department",
    description: "Horizontal stacked bar chart showing alert volume per department",
    defaultSize: { w: 5, h: 6 },
    minSize: { w: 3, h: 4 },
    category: "alerts",
    defaultVisible: false,
  },
  {
    type: "breach-source-donut",
    defaultTitle: "Breach Origin",
    description: "Donut chart breaking down breaches by source: HIBP, Manual, Dark Web",
    defaultSize: { w: 3, h: 6 },
    minSize: { w: 2, h: 4 },
    category: "breaches",
    defaultVisible: false,
  },
  {
    type: "breach-timeline",
    defaultTitle: "Breach Timeline",
    description: "Vertical chronological timeline of recent breaches with source and impact",
    defaultSize: { w: 4, h: 8 },
    minSize: { w: 3, h: 5 },
    category: "breaches",
    defaultVisible: false,
  },
  {
    type: "top-breaches",
    defaultTitle: "Top Breaches by Impact",
    description: "Horizontal bar chart ranking breaches by number of affected employees",
    defaultSize: { w: 5, h: 6 },
    minSize: { w: 3, h: 4 },
    category: "breaches",
    defaultVisible: false,
  },
  {
    type: "data-type-radar",
    defaultTitle: "Data Type Radar",
    description: "Radar chart showing the relative spread of compromised data categories",
    defaultSize: { w: 4, h: 6 },
    minSize: { w: 3, h: 4 },
    category: "breaches",
    defaultVisible: false,
  },
]

export function getWidgetDef(type: string): WidgetDef | undefined {
  return WIDGETS.find((w) => w.type === type)
}

export { WIDGETS }
