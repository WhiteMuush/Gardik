import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { encryptConfig, decryptConfig } from "./crypto"

const KEY_A = "a".repeat(40)
const KEY_B = "b".repeat(40)

describe("crypto config encryption", () => {
  beforeEach(() => {
    process.env.DIRECTORY_ENCRYPTION_KEY = KEY_A
    delete process.env.DIRECTORY_ENCRYPTION_KEY_PREVIOUS
  })
  afterEach(() => {
    delete process.env.DIRECTORY_ENCRYPTION_KEY
    delete process.env.DIRECTORY_ENCRYPTION_KEY_PREVIOUS
  })

  it("round-trips an object", () => {
    const data = { token: "s3cret", nested: { a: 1 } }
    expect(decryptConfig(encryptConfig(data))).toEqual(data)
  })

  it("produces a different IV each call (non-deterministic ciphertext)", () => {
    const a = encryptConfig({ x: 1 })
    const b = encryptConfig({ x: 1 })
    expect(a).not.toBe(b)
  })

  it("rejects a tampered ciphertext via the GCM auth tag", () => {
    const enc = encryptConfig({ x: 1 })
    const buf = Buffer.from(enc, "base64")
    buf[buf.length - 1] ^= 0xff
    expect(() => decryptConfig(buf.toString("base64"))).toThrow()
  })

  it("throws when the key is missing or too short", () => {
    delete process.env.DIRECTORY_ENCRYPTION_KEY
    expect(() => encryptConfig({ x: 1 })).toThrow(/missing or too short/i)
    process.env.DIRECTORY_ENCRYPTION_KEY = "short"
    expect(() => encryptConfig({ x: 1 })).toThrow(/missing or too short/i)
  })

  it("decrypts with the previous key after rotation", () => {
    // Encrypted under KEY_A (the old key).
    const old = encryptConfig({ token: "old" })
    // Rotate: KEY_B becomes current, KEY_A moves to previous.
    process.env.DIRECTORY_ENCRYPTION_KEY = KEY_B
    process.env.DIRECTORY_ENCRYPTION_KEY_PREVIOUS = KEY_A
    expect(decryptConfig(old)).toEqual({ token: "old" })
    // New writes use KEY_B and still decrypt.
    const fresh = encryptConfig({ token: "new" })
    expect(decryptConfig(fresh)).toEqual({ token: "new" })
  })

  it("fails to decrypt once the previous key is dropped", () => {
    const old = encryptConfig({ token: "old" })
    process.env.DIRECTORY_ENCRYPTION_KEY = KEY_B
    expect(() => decryptConfig(old)).toThrow()
  })
})
