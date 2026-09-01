import { describe, it, expect, afterEach } from "vitest"
import { appBaseUrl } from "./appUrl"

const saved = { AUTH_URL: process.env.AUTH_URL, BETTER_AUTH_URL: process.env.BETTER_AUTH_URL }

afterEach(() => {
  process.env.AUTH_URL = saved.AUTH_URL
  process.env.BETTER_AUTH_URL = saved.BETTER_AUTH_URL
  if (saved.AUTH_URL === undefined) delete process.env.AUTH_URL
  if (saved.BETTER_AUTH_URL === undefined) delete process.env.BETTER_AUTH_URL
})

describe("appBaseUrl", () => {
  it("uses BETTER_AUTH_URL, the name .env.example ships", () => {
    delete process.env.AUTH_URL
    process.env.BETTER_AUTH_URL = "https://gardik.example.com"
    expect(appBaseUrl()).toBe("https://gardik.example.com")
  })

  it("still honours the pre-migration AUTH_URL, which wins when both are set", () => {
    process.env.AUTH_URL = "https://legacy.example.com"
    process.env.BETTER_AUTH_URL = "https://gardik.example.com"
    expect(appBaseUrl()).toBe("https://legacy.example.com")
  })

  it("falls back to localhost when neither is set", () => {
    delete process.env.AUTH_URL
    delete process.env.BETTER_AUTH_URL
    expect(appBaseUrl()).toBe("http://localhost:3000")
  })

  it("drops a trailing slash so callers can append a path", () => {
    delete process.env.AUTH_URL
    process.env.BETTER_AUTH_URL = "https://gardik.example.com/"
    expect(appBaseUrl()).toBe("https://gardik.example.com")
  })
})
