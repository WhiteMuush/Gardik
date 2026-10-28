export type ConnectStatus = "ACTIVE" | "ERROR" | "PENDING"
export type DirectoryType = "AZURE_AD" | "GOOGLE_WORKSPACE" | "LDAP" | "AWS_DIRECTORY" | "OKTA" | "SCIM"

export type Connection = {
  id: string
  type: DirectoryType
  name: string
  status: ConnectStatus
  lastSyncAt: string | null
  lastSyncCount: number | null
  errorMessage: string | null
  createdAt: string
}

export const STATUS_DOT: Record<ConnectStatus, string> = {
  ACTIVE: "bg-green-500",
  ERROR: "bg-destructive",
  PENDING: "bg-yellow-500",
}

export const STATUS_LABEL: Record<ConnectStatus, string> = {
  ACTIVE: "Active",
  ERROR: "Error",
  PENDING: "Pending",
}

export function formatDate(iso: string | null) {
  if (!iso) return "Never"
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}
