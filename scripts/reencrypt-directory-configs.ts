// Re-encrypts every directory config under the current key during a rotation (see the wiki Configuration page).
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
