import { PROVIDERS, type DirectoryType, type ProviderOption } from "../connect-wizard/providers"
import type { Connection } from "./meta"

export type DirectoryStatus = "ACTIVE" | "ERROR" | "PENDING" | "NOT_CONNECTED"

export type DirectoryView = {
  provider: ProviderOption
  logo: string
  initials: string
  connections: Connection[]
  status: DirectoryStatus
}

export type DirectoryFilter = "All" | "Connected" | "Not connected" | "Needs action"

export const DIRECTORY_FILTERS: DirectoryFilter[] = ["All", "Connected", "Not connected", "Needs action"]

const BRAND: Record<DirectoryType, { logo: string; initials: string }> = {
  AZURE_AD: { logo: "/sources/microsoft.png", initials: "AZ" },
  GOOGLE_WORKSPACE: { logo: "/sources/google.png", initials: "GW" },
  LDAP: { logo: "/sources/active-directory.svg", initials: "LD" },
  AWS_DIRECTORY: { logo: "/sources/aws.png", initials: "AW" },
  OKTA: { logo: "/sources/okta.png", initials: "OK" },
  SCIM: { logo: "/sources/scim.png", initials: "SC" },
}

export function directoryStatus(connections: Connection[]): DirectoryStatus {
  if (connections.length === 0) return "NOT_CONNECTED"
  if (connections.some((c) => c.status === "ERROR")) return "ERROR"
  if (connections.some((c) => c.status === "ACTIVE")) return "ACTIVE"
  return "PENDING"
}

export function buildDirectoryViews(connections: Connection[]): DirectoryView[] {
  return PROVIDERS.map((provider) => {
    const own = connections.filter((c) => c.type === provider.type)
    return { provider, ...BRAND[provider.type], connections: own, status: directoryStatus(own) }
  })
}

export function matchesDirectory(view: DirectoryView, filter: DirectoryFilter, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q && !`${view.provider.label} ${view.provider.description}`.toLowerCase().includes(q)) return false
  if (filter === "Connected") return view.connections.length > 0
  if (filter === "Not connected") return view.connections.length === 0
  if (filter === "Needs action") return view.status === "ERROR"
  return true
}

export function lastSyncAt(connections: Connection[]): string | null {
  const dates = connections.map((c) => c.lastSyncAt).filter((d): d is string => d !== null)
  return dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null
}
