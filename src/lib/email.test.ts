import { describe, it, expect } from "vitest"
import { breachAlertHtml } from "./email"

describe("breachAlertHtml", () => {
  it("escapes values that come from breach sources", () => {
    const html = breachAlertHtml({
      employeeName: "Jane <b>Doe</b>",
      breachName: `Acme"><a href="https://evil.example">Reset your password</a>`,
      dataTypes: ["password", "<img src=x onerror=alert(1)>"],
      severity: "HIGH",
    })
    expect(html).not.toContain("<b>Doe</b>")
    expect(html).not.toContain('<a href="https://evil.example">')
    expect(html).not.toContain("<img")
    expect(html).toContain("Acme&quot;&gt;&lt;a href=&quot;https://evil.example&quot;&gt;Reset your password&lt;/a&gt;")
    expect(html).toContain("Jane &lt;b&gt;Doe&lt;/b&gt;")
  })
})
