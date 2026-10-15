import { guardPage } from "@/lib/rbac/guard-page"
import { getSession } from "@/lib/auth/session"
import { authorize } from "@/lib/rbac/authorize"
import { permissionsForRole } from "@/lib/rbac/session-permissions"
import { visiblePages } from "@/lib/rbac/page-permissions"
import { getDashboardData } from "@/lib/dashboard"
import { loadDashboardPresets } from "@/lib/dashboard-presets"
import { providerMeta } from "@/lib/credentials/providers"
import { prisma } from "@/lib/prisma"
import type { ApiProvider } from "@prisma/client"
import { DashboardCanvas } from "@/components/dashboard/DashboardCanvas"
import { ScanCoverageBanner } from "@/components/employees/ScanCoverageBanner"
import { getScanCoverage } from "@/lib/scan/coverage"
import { redirect } from "next/navigation"
import { defaultWidgets } from "./default-widgets"
import { libraryWidgets } from "./library-widgets"

export default async function DashboardPage() {
  const denied = await guardPage("dashboard:read")
  if (denied) return denied

  const session = await getSession()

  const [employeeCount, apiKeyCount] = await Promise.all([
    prisma.employee.count({ where: { companyId: session!.user.companyId } }),
    prisma.apiCredential.count({ where: { companyId: session!.user.companyId } }),
  ])

  if (employeeCount === 0 && apiKeyCount === 0) redirect("/setup")

  const [data, { typedPresets, activePresetId }, coverage] = await Promise.all([
    getDashboardData(session!.user.companyId),
    loadDashboardPresets(session!.user.id, session!.user.companyId),
    getScanCoverage(session!.user.companyId),
  ])

  const perms = await permissionsForRole(session!.user.roleId ?? null)
  const canManageShared = authorize(perms, "dashboard:manage_shared")
  const visible = visiblePages(perms)

  const credentials = await prisma.apiCredential.findMany({
    where: { companyId: session!.user.companyId },
    select: { provider: true },
  })
  const sourceOptions = credentials.map((c) => ({
    id: c.provider as string,
    label: providerMeta(c.provider)?.label ?? c.provider,
  }))

  // Each widget's chosen source comes from the active preset, and filterable widgets re-derive their slice from it.
  const activeWidgets = typedPresets.find((p) => p.id === activePresetId)?.widgets ?? []
  const sourceFor = (instanceId: string): ApiProvider | undefined => {
    const s = activeWidgets.find((w) => w.instanceId === instanceId)?.source
    return (s ?? undefined) as ApiProvider | undefined
  }

  const ctx = { data, sourceFor }
  const widgets = [...defaultWidgets(ctx), ...libraryWidgets(ctx)]

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <ScanCoverageBanner
        coverage={coverage}
        canScan={authorize(perms, "employees:scan")}
        className="mx-4 mt-4 shrink-0"
      />
      <DashboardCanvas
        widgets={widgets}
        presets={typedPresets}
        activePresetId={activePresetId}
        canManageShared={canManageShared}
        visible={visible}
        sourceOptions={sourceOptions}
      />
    </div>
  )
}
