import { prisma } from "@/lib/prisma"
import type { OrgInfo } from "./types"

// The organisation named on the report. companyId comes from the authenticated
// session, so a missing row means broken referential integrity, not a normal
// empty result. Throw rather than fall back to a placeholder name that would
// silently mislead the reader of a security document.
export async function getOrgInfo(companyId: string): Promise<OrgInfo> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, domain: true },
  })
  if (!company) throw new Error(`Report requested for unknown company ${companyId}`)
  return { name: company.name, domain: company.domain }
}
