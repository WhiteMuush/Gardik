export function rate(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

export function monthKey(date: Date): string {
  return date.toLocaleString("en-US", { month: "short", year: "2-digit" })
}
