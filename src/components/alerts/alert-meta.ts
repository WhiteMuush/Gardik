export const borderBySeverity: Record<string, string> = {
  CRITICAL: "border-l-severity-critical",
  HIGH: "border-l-severity-high",
  MEDIUM: "border-l-severity-medium",
  LOW: "border-l-severity-low",
}

// Confidence is source reliability, not impact, so a low-confidence hit is muted for the responder to verify first.
export const confidenceChip: Record<string, string> = {
  HIGH: "border-border text-muted-foreground",
  MEDIUM: "border-border text-muted-foreground",
  LOW: "border-severity-medium/40 text-severity-medium-fg",
}

export const confidenceLabel: Record<string, string> = {
  HIGH: "High confidence",
  MEDIUM: "Medium confidence",
  LOW: "Low confidence",
}

export const statusLabel: Record<string, string> = {
  OPEN: "Open",
  ACKNOWLEDGED: "Acknowledged",
  RESOLVED: "Resolved",
}

export function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (s < 60) return "just now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}
