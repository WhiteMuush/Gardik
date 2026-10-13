import { Building2, Cloud, Globe, Link, Network, Shield } from "lucide-react"

export type DirectoryType = "AZURE_AD" | "GOOGLE_WORKSPACE" | "LDAP" | "AWS_DIRECTORY" | "OKTA" | "SCIM"

export type ProviderOption = {
  type: DirectoryType
  label: string
  description: string
  icon: React.ReactNode
  docsUrl: string
}

export const PROVIDERS: ProviderOption[] = [
  {
    type: "AZURE_AD",
    label: "Microsoft Azure AD / Entra ID",
    description: "Microsoft 365, Entra ID, hybrid on-prem",
    icon: <Building2 className="size-5" />,
    docsUrl: "https://learn.microsoft.com/fr-fr/entra/identity/",
  },
  {
    type: "GOOGLE_WORKSPACE",
    label: "Google Workspace",
    description: "Gmail, Google Workspace Business / Enterprise",
    icon: <Globe className="size-5" />,
    docsUrl: "https://developers.google.com/workspace/admin/directory/reference/rest",
  },
  {
    type: "LDAP",
    label: "LDAP / Active Directory",
    description: "OpenLDAP, on-premise Active Directory, FreeIPA",
    icon: <Network className="size-5" />,
    docsUrl: "",
  },
  {
    type: "AWS_DIRECTORY",
    label: "AWS IAM Identity Center",
    description: "AWS Directory Service, AWS SSO, Managed Microsoft AD",
    icon: <Cloud className="size-5" />,
    docsUrl: "https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html",
  },
  {
    type: "OKTA",
    label: "Okta",
    description: "Okta Workforce Identity Cloud",
    icon: <Shield className="size-5" />,
    docsUrl: "https://developer.okta.com/docs/reference/api/users/",
  },
  {
    type: "SCIM",
    label: "SCIM 2.0",
    description: "OVH, JumpCloud, OneLogin, Ping Identity, IBM, Oracle and any SCIM-compatible provider",
    icon: <Link className="size-5" />,
    docsUrl: "",
  },
]
