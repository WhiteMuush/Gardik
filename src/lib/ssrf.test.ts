import { describe, expect, it } from "vitest"
import { isPrivateAddress, parseOutboundUrl } from "./ssrf"

describe("isPrivateAddress", () => {
  it("rejects loopback", () => {
    expect(isPrivateAddress("127.0.0.1")).toBe(true)
    expect(isPrivateAddress("127.255.255.254")).toBe(true)
    expect(isPrivateAddress("::1")).toBe(true)
  })

  it("rejects the RFC1918 ranges", () => {
    expect(isPrivateAddress("10.0.0.1")).toBe(true)
    expect(isPrivateAddress("172.16.0.1")).toBe(true)
    expect(isPrivateAddress("172.31.255.255")).toBe(true)
    expect(isPrivateAddress("192.168.1.1")).toBe(true)
  })

  it("keeps 172.15 and 172.32 public, they sit outside the /12", () => {
    expect(isPrivateAddress("172.15.0.1")).toBe(false)
    expect(isPrivateAddress("172.32.0.1")).toBe(false)
  })

  it("rejects link-local, including the cloud metadata address", () => {
    expect(isPrivateAddress("169.254.169.254")).toBe(true)
    expect(isPrivateAddress("fe80::1")).toBe(true)
  })

  it("rejects carrier-grade NAT, unspecified and unique local v6", () => {
    expect(isPrivateAddress("100.64.0.1")).toBe(true)
    expect(isPrivateAddress("0.0.0.0")).toBe(true)
    expect(isPrivateAddress("fc00::1")).toBe(true)
    expect(isPrivateAddress("fd12:3456::1")).toBe(true)
  })

  it("rejects IPv4-mapped IPv6 that wraps a private v4", () => {
    expect(isPrivateAddress("::ffff:127.0.0.1")).toBe(true)
    expect(isPrivateAddress("::ffff:10.0.0.1")).toBe(true)
  })

  it("accepts ordinary public addresses", () => {
    expect(isPrivateAddress("1.1.1.1")).toBe(false)
    expect(isPrivateAddress("93.184.216.34")).toBe(false)
    expect(isPrivateAddress("2606:4700::1111")).toBe(false)
  })
})

describe("parseOutboundUrl", () => {
  it("requires https", () => {
    expect(parseOutboundUrl("http://example.com/hook")).toEqual({ error: "URL must use https" })
  })

  it("rejects a literal private host without needing DNS", () => {
    expect(parseOutboundUrl("https://127.0.0.1/hook")).toEqual({
      error: "URL must point to a public host",
    })
    expect(parseOutboundUrl("https://169.254.169.254/latest/meta-data")).toEqual({
      error: "URL must point to a public host",
    })
    expect(parseOutboundUrl("https://[::1]/hook")).toEqual({
      error: "URL must point to a public host",
    })
  })

  it("rejects credentials embedded in the URL", () => {
    expect(parseOutboundUrl("https://user:pass@example.com/hook")).toEqual({
      error: "URL must not embed credentials",
    })
  })

  it("rejects a malformed URL", () => {
    expect(parseOutboundUrl("not a url")).toEqual({ error: "Invalid URL" })
  })

  it("accepts a normal https endpoint", () => {
    const out = parseOutboundUrl("https://hooks.slack.com/services/T/B/xyz")
    expect("url" in out && out.url.host).toBe("hooks.slack.com")
  })
})
