import type { vi } from "vitest"

export function provider(lookup: ReturnType<typeof vi.fn>, id = "HIBP", source = "HIBP") {
  return { provider: { lookup, source, id }, key: "k", ratePerMinute: 60 } as never
}

export function emptyEmployee(id = "e1", scanChecks: { provider: string; status: string }[] = []) {
  return {
    id,
    email: `${id}@x.com`,
    firstName: "E",
    lastName: "One",
    breachRecords: [],
    alerts: [],
    scanChecks,
  }
}
