import { describe, it, expect } from "vitest"
import {
  hasSpecialCategory,
  hoursUntilDeadline,
  isNotificationOverdue,
  mapToGdprCategories,
  notificationDeadline,
} from "./gdpr"

describe("mapToGdprCategories", () => {
  it("maps data types to unique sorted GDPR categories", () => {
    expect(mapToGdprCategories(["password", "email", "credit_card"])).toEqual([
      "contact",
      "credentials",
      "financial",
    ])
  })

  it("falls back to other_personal_data for unknown types", () => {
    expect(mapToGdprCategories(["mystery"])).toEqual(["other_personal_data"])
  })
})

describe("hasSpecialCategory", () => {
  it("flags Article 9 data", () => {
    expect(hasSpecialCategory(["health_records"])).toBe(true)
    expect(hasSpecialCategory(["email"])).toBe(false)
  })
})

describe("72h deadline helpers", () => {
  const detected = new Date("2026-06-22T00:00:00.000Z")

  it("sets the deadline 72 hours after detection", () => {
    expect(notificationDeadline(detected).toISOString()).toBe("2026-06-25T00:00:00.000Z")
  })

  it("counts whole hours remaining and flags overdue", () => {
    const now = new Date("2026-06-23T00:00:00.000Z")
    expect(hoursUntilDeadline(detected, now)).toBe(48)
    expect(isNotificationOverdue(detected, now)).toBe(false)
    expect(isNotificationOverdue(detected, new Date("2026-06-26T00:00:00.000Z"))).toBe(true)
  })
})
