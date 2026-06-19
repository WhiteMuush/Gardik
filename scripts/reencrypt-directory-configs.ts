/**
 * Re-encrypts every DirectoryConnection.encryptedConfig with the current
 * DIRECTORY_ENCRYPTION_KEY. Used during key rotation.
 *
 * Procedure:
 *   1. Set DIRECTORY_ENCRYPTION_KEY to the new key and
 *      DIRECTORY_ENCRYPTION_KEY_PREVIOUS to the old key.
 *   2. Deploy (decryption already falls back to the previous key).
 *   3. Run this script: it decrypts each row (current or previous key) and
 *      writes it back encrypted under the current key.
 *   4. Once it completes cleanly, remove DIRECTORY_ENCRYPTION_KEY_PREVIOUS.
 *
 * Idempotent: re-running re-encrypts rows already on the current key.
 *
 *   npx tsx scripts/reencrypt-directory-configs.ts
 */
import { prisma } from "../src/lib/prisma"
import { decryptConfig, encryptConfig } from "../src/lib/directory/crypto"

async function main() {
  const rows = await prisma.directoryConnection.findMany({
    select: { id: true, encryptedConfig: true },
  })

  let ok = 0
  const failed: string[] = []

  for (const row of rows) {
    try {
      const config = decryptConfig<object>(row.encryptedConfig)
      await prisma.directoryConnection.update({
        where: { id: row.id },
        data: { encryptedConfig: encryptConfig(config) },
      })
      ok++
    } catch {
      failed.push(row.id)
    }
  }

  console.log(`Re-encrypted ${ok}/${rows.length} connection(s).`)
  if (failed.length) {
    console.error(`Could not decrypt ${failed.length}: ${failed.join(", ")}`)
    process.exitCode = 1
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
