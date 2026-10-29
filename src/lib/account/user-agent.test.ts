import { describe, it, expect } from "vitest"
import { describeUserAgent } from "./user-agent"

const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
const EDGE_WINDOWS = `${CHROME_WINDOWS} Edg/140.0.0.0`
const FIREFOX_LINUX = "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0"
const SAFARI_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15"
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1"
const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36"

describe("describeUserAgent", () => {
  it.each([
    [CHROME_WINDOWS, "Chrome on Windows"],
    [EDGE_WINDOWS, "Edge on Windows"],
    [FIREFOX_LINUX, "Firefox on Linux"],
    [SAFARI_MAC, "Safari on macOS"],
    [SAFARI_IPHONE, "Safari on iOS"],
    [CHROME_ANDROID, "Chrome on Android"],
  ])("names the browser and system of %s", (ua, expected) => {
    expect(describeUserAgent(ua)).toBe(expected)
  })

  it("falls back when nothing is known", () => {
    expect(describeUserAgent(null)).toBe("Unknown device")
    expect(describeUserAgent("curl/8.9.1")).toBe("Unknown device")
  })

  it("keeps whichever half it recognizes", () => {
    expect(describeUserAgent("SomeBot/1.0 (Windows NT 10.0)")).toBe("Unknown browser on Windows")
  })
})
