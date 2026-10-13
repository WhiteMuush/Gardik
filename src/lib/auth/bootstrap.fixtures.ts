import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { MIN_BOOTSTRAP_TOKEN_LENGTH } from "./bootstrap"

// Each test clears every company inside a transaction that is always rolled back, since the gate needs an empty database.
export const ROLLBACK = Symbol("rollback")

export async function onEmptyDb<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  let captured: T
  try {
    await prisma.$transaction(async (tx) => {
      await tx.company.deleteMany({})
      captured = await fn(tx)
      throw ROLLBACK
    })
  } catch (error) {
    if (error !== ROLLBACK) throw error
  }
  return captured!
}

export const config = {
  email: "admin@bootstrap.test",
  domain: "bootstrap.test",
  token: `bootstrap-${"z".repeat(MIN_BOOTSTRAP_TOKEN_LENGTH)}`,
}
