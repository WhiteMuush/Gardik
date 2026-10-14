import { prisma } from "@/lib/prisma"
import type { OrgInfo } from "./types"

// Throws on a missing row, since a placeholder name would silently mislead a security document.
export async function getOrgInfo(companyId: string): Promise<OrgInfo> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, domain: true },
  })
  if (!company) throw new Error(`Report requested for unknown company ${companyId}`)
  return { name: company.name, domain: company.domain }
}
