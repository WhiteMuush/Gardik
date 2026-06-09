import type { ApiProvider } from "@prisma/client"
import type { BreachProvider } from "./types"
import { hibp } from "./providers/hibp"
import { leakcheck } from "./providers/leakcheck"
import { dehashed } from "./providers/dehashed"
import { intelx } from "./providers/intelx"
import { snusbase } from "./providers/snusbase"

// Tous les providers branchés. Ajouter une source = ajouter une entrée ici.
export const PROVIDERS: BreachProvider[] = [hibp, leakcheck, dehashed, intelx, snusbase]

export function providerById(id: ApiProvider): BreachProvider | undefined {
  return PROVIDERS.find((p) => p.id === id)
}
