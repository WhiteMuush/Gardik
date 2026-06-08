import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

const IV_LENGTH = 12 // nonce recommandé pour AES-GCM
const TAG_LENGTH = 16

// Dérive une clé AES-256 (32 octets) depuis le secret d'environnement.
// Aucun repli silencieux : on échoue explicitement si le secret est absent ou trop court.
function getKey(): Buffer {
  const raw = process.env.DIRECTORY_ENCRYPTION_KEY
  if (!raw || raw.length < 32) {
    throw new Error(
      "DIRECTORY_ENCRYPTION_KEY absente ou trop courte (32 caractères minimum)."
    )
  }
  // sha256 normalise n'importe quelle longueur d'entrée en exactement 32 octets.
  return createHash("sha256").update(raw, "utf8").digest()
}

export function encryptConfig(data: object): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv)
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
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8")
  return JSON.parse(decrypted) as T
}
