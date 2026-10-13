import { describe, it, expect, vi, afterEach } from "vitest"
import { saveRequest } from "./save-request"

afterEach(() => vi.restoreAllMocks())

describe("saveRequest", () => {
  it("returns the response when the server accepts", async () => {
    const fetch = vi.spyOn(global, "fetch").mockResolvedValue({ ok: true, status: 200 } as Response)
    const res = await saveRequest("/api/x", "PUT", { a: 1 })
    expect(res?.status).toBe(200)
    expect(fetch).toHaveBeenCalledWith("/api/x", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: '{"a":1}',
    })
  })

  it("sends no body when there is none", async () => {
    const fetch = vi.spyOn(global, "fetch").mockResolvedValue({ ok: true, status: 204 } as Response)
    await saveRequest("/api/x", "DELETE")
    expect(fetch).toHaveBeenCalledWith("/api/x", { method: "DELETE", headers: undefined, body: undefined })
  })

  it("returns null when the server refuses", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 500 } as Response)
    expect(await saveRequest("/api/x", "PUT", {})).toBeNull()
  })

  it("returns null when the network fails", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new TypeError("Failed to fetch"))
    expect(await saveRequest("/api/x", "PUT", {})).toBeNull()
  })
})
