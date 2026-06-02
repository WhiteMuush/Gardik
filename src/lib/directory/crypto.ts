import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

function getKey(): Buffer {
  const raw = process.env.DIRECTORY_ENCRYPTION_KEY ?? "datashield-default-key-32-chars!!"
  return Buffer.from(raw, "utf8").subarray(0, 32)
}

export function encryptConfig(data: object): string {
  const key = getKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString("base64")
}

export function decryptConfig<T>(encoded: string): T {
  const key = getKey()
  const buf = Buffer.from(encoded, "base64")
  const iv = buf.subarray(0, 16)
  const tag = buf.subarray(16, 32)
  const encrypted = buf.subarray(32)
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)
  const decrypted = decipher.update(encrypted).toString("utf8") + decipher.final("utf8")
  return JSON.parse(decrypted) as T
}
