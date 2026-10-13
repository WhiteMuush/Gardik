import { Building2, Globe, Network, Cloud, Shield, Link } from "lucide-react"

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

export const TYPE_META: Record<DirectoryType, { label: string; icon: React.ReactNode; color: string }> = {
  AZURE_AD: {
    label: "Azure AD",
    icon: <Building2 className="size-4" />,
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  GOOGLE_WORKSPACE: {
    label: "Google Workspace",
    icon: <Globe className="size-4" />,
    color: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
  LDAP: {
    label: "LDAP",
    icon: <Network className="size-4" />,
    color: "bg-muted text-muted-foreground",
  },
  AWS_DIRECTORY: {
    label: "AWS Identity Center",
    icon: <Cloud className="size-4" />,
    color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  OKTA: {
    label: "Okta",
    icon: <Shield className="size-4" />,
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  SCIM: {
    label: "SCIM 2.0",
    icon: <Link className="size-4" />,
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
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
