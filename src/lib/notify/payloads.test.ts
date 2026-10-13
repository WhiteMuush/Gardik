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
    expect(p.text).toContain("Jane Doe found in `Acme`")
    expect(p.text).toContain("`password, email`")
  })
})

describe("teamsPayload", () => {
  it("builds a MessageCard with a severity color and facts", () => {
    const p = teamsPayload(event)
    expect(p["@type"]).toBe("MessageCard")
    expect(p.themeColor).toBe("D32F2F")
    expect(p.sections[0].facts).toContainEqual({ name: "Source", value: "`Acme`" })
  })

  it("falls back to unknown data when no types leaked", () => {
    const p = teamsPayload({ ...event, dataTypes: [] })
    expect(p.sections[0].facts).toContainEqual({ name: "Exposed data", value: "unknown data" })
  })
})

// Breach names come from external sources, some of them dark web aggregators.
const hostile: WebhookEvent = {
  employeeName: "Jane <b>Doe</b>",
  breachName: "<!channel> <https://evil.example|Reset your password> [Click](https://evil.example) `x`",
  dataTypes: ["password", "<!here>"],
  severity: "HIGH",
}

describe("untrusted values in Slack", () => {
  it("escapes control characters so nothing becomes a mention or a link", () => {
    const { text } = slackPayload(hostile)
    expect(text).not.toContain("<!channel>")
    expect(text).not.toContain("<!here>")
    expect(text).not.toContain("<https://")
    expect(text).toContain("&lt;!channel&gt;")
  })

  it("shows the breach name and data as inline code, never as formatted text", () => {
    const { text } = slackPayload(hostile)
    expect(text).toContain(
      "`&lt;!channel&gt; &lt;https://evil.example|Reset your password&gt; [Click](https://evil.example) 'x'`"
    )
    expect(text).toContain("Exposed data: `password, &lt;!here&gt;`")
  })
})

describe("untrusted values in Teams", () => {
  it("shows the breach name and data as inline code so links do not render", () => {
    const facts = teamsPayload(hostile).sections[0].facts
    expect(facts).toContainEqual({
      name: "Source",
      value:
        "`&lt;!channel&gt; &lt;https://evil.example|Reset your password&gt; [Click](https://evil.example) 'x'`",
    })
    expect(facts).toContainEqual({ name: "Exposed data", value: "`password, &lt;!here&gt;`" })
  })
})
