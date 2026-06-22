import type { ApiProvider } from "@prisma/client"
import type { BreachProvider } from "./types"
import { hibp } from "./providers/hibp"
import { hibpStealer } from "./providers/hibpStealer"
import { leakcheck } from "./providers/leakcheck"
import { dehashed } from "./providers/dehashed"
import { intelx } from "./providers/intelx"
import { snusbase } from "./providers/snusbase"

// Every wired provider. Adding a source = adding an entry here.
export const PROVIDERS: BreachProvider[] = [hibp, hibpStealer, leakcheck, dehashed, intelx, snusbase]

export function providerById(id: ApiProvider): BreachProvider | undefined {
  return PROVIDERS.find((p) => p.id === id)
}
