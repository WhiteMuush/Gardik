export type DirectoryType = "AZURE_AD" | "GOOGLE_WORKSPACE" | "LDAP" | "AWS_DIRECTORY" | "OKTA" | "SCIM"

export type ProviderOption = {
  type: DirectoryType
  label: string
  description: string
  docsUrl: string
}

export const PROVIDERS: ProviderOption[] = [
  {
    type: "AZURE_AD",
    label: "Microsoft Azure AD / Entra ID",
    description: "Microsoft 365, Entra ID, hybrid on-prem",
    docsUrl: "https://learn.microsoft.com/fr-fr/entra/identity/",
  },
  {
    type: "GOOGLE_WORKSPACE",
    label: "Google Workspace",
    description: "Gmail, Google Workspace Business / Enterprise",
    docsUrl: "https://developers.google.com/workspace/admin/directory/reference/rest",
  },
  {
    type: "LDAP",
    label: "LDAP / Active Directory",
    description: "OpenLDAP, on-premise Active Directory, FreeIPA",
    docsUrl: "",
  },
  {
    type: "AWS_DIRECTORY",
    label: "AWS IAM Identity Center",
    description: "AWS Directory Service, AWS SSO, Managed Microsoft AD",
    docsUrl: "https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html",
  },
  {
    type: "OKTA",
    label: "Okta",
    description: "Okta Workforce Identity Cloud",
    docsUrl: "https://developer.okta.com/docs/reference/api/users/",
  },
  {
    type: "SCIM",
    label: "SCIM 2.0",
    description: "OVH, JumpCloud, OneLogin, Ping Identity, IBM, Oracle and any SCIM-compatible provider",
    docsUrl: "",
  },
]
