import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

const IV_LENGTH = 12 // recommended nonce length for AES-GCM
const TAG_LENGTH = 16

// sha256 normalizes any input length to exactly 32 bytes (AES-256 key).
function deriveKey(raw: string): Buffer {
  return createHash("sha256").update(raw, "utf8").digest()
}

// Returns the decryption keys in priority order: the current key first, then
// the optional previous key. Encryption always uses the first (current) key;
// decryption falls back to the previous one so a key rotation can run without
// downtime (rotate env, then re-encrypt rows in the background).
// No silent fallback on a missing/short current key: fail loudly.
function getKeys(): Buffer[] {
  const current = process.env.DIRECTORY_ENCRYPTION_KEY
  if (!current || current.length < 32) {
    throw new Error(
      "DIRECTORY_ENCRYPTION_KEY missing or too short (32 characters minimum)."
    )
  }
  const keys = [deriveKey(current)]
  const previous = process.env.DIRECTORY_ENCRYPTION_KEY_PREVIOUS
  if (previous && previous.length >= 32) keys.push(deriveKey(previous))
  return keys
}

export function encryptConfig(data: object): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv("aes-256-gcm", getKeys()[0], iv)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString("base64")
}

export function decryptConfig<T>(encoded: string): T {
  const buf = Buffer.from(encoded, "base64")
  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH)

  // Try each key in order. The GCM auth tag check throws on the wrong key, so
  // a failure just means "try the previous key". Throw the last error if none
  // succeed, rather than leaking a partial result.
  let lastError: unknown
  for (const key of getKeys()) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, iv)
      decipher.setAuthTag(tag)
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString("utf8")
      return JSON.parse(decrypted) as T
    } catch (e) {
      lastError = e
    }
  }
  throw lastError ?? new Error("Failed to decrypt config")
}
