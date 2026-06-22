import { describe, it, expect } from "vitest"
import { slackPayload, summaryLine, teamsPayload } from "./payloads"
import type { WebhookEvent } from "@/lib/webhooks"

const event: WebhookEvent = {
  employeeName: "Jane Doe",
  breachName: "Acme",
  dataTypes: ["password", "email"],
  severity: "CRITICAL",
}

describe("summaryLine", () => {
  it("reads severity, employee and source", () => {
    expect(summaryLine(event)).toBe("CRITICAL exposure: Jane Doe found in Acme")
  })
})

describe("slackPayload", () => {
  it("puts the summary and data in text", () => {
    const p = slackPayload(event)
    expect(p.text).toContain("Jane Doe found in Acme")
    expect(p.text).toContain("password, email")
  })
})

describe("teamsPayload", () => {
  it("builds a MessageCard with a severity color and facts", () => {
    const p = teamsPayload(event)
    expect(p["@type"]).toBe("MessageCard")
    expect(p.themeColor).toBe("D32F2F")
    expect(p.sections[0].facts).toContainEqual({ name: "Source", value: "Acme" })
  })

  it("falls back to unknown data when no types leaked", () => {
    const p = teamsPayload({ ...event, dataTypes: [] })
    expect(p.sections[0].facts).toContainEqual({ name: "Exposed data", value: "unknown data" })
  })
})
