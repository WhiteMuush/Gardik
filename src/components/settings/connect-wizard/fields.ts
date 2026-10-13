import type { DirectoryType } from "./providers"

export type FieldDef = {
  key: string
  label: string
  placeholder?: string
  type?: "text" | "password" | "number" | "textarea"
  secret?: boolean
  hint?: string
}

export const FIELDS: Record<DirectoryType, FieldDef[]> = {
  AZURE_AD: [
    {
      key: "tenantId",
      label: "Tenant ID",
      placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      hint: "Azure portal > Microsoft Entra ID > Properties > Tenant ID",
    },
    {
      key: "clientId",
      label: "Client ID (App Registration)",
      placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      hint: "Azure portal > App registrations > your app > Application (client) ID",
    },
    {
      key: "clientSecret",
      label: "Client Secret",
      placeholder: "Your application secret",
      type: "password",
      hint: "Required permission: User.Read.All (Application)",
    },
  ],
  GOOGLE_WORKSPACE: [
    {
      key: "serviceAccountEmail",
      label: "Service account email",
      placeholder: "gardik@my-project.iam.gserviceaccount.com",
      hint: "Google Cloud Console > IAM > Service accounts",
    },
    {
      key: "privateKey",
      label: "Private key (RSA)",
      type: "textarea",
      secret: true,
      placeholder: "Paste the full key, from -----BEGIN to -----END",
      hint: "Service account JSON file > private_key field",
    },
    {
      key: "delegatedAdminEmail",
      label: "Delegated admin email",
      placeholder: "admin@yourdomain.com",
      hint: "Google Workspace admin account used for domain-wide delegation",
    },
    {
      key: "domain",
      label: "Domain",
      placeholder: "yourdomain.com",
      hint: "Primary domain of your Google Workspace",
    },
  ],
  OKTA: [
    {
      key: "domain",
      label: "Okta domain",
      placeholder: "company.okta.com",
      hint: "Your Okta organization URL without https://",
    },
    {
      key: "apiToken",
      label: "API token",
      type: "password" as const,
      placeholder: "00abc123...",
      hint: "Okta Admin Console > Security > API > Tokens > Create token",
    },
  ],
  SCIM: [],
  AWS_DIRECTORY: [
    {
      key: "accessKeyId",
      label: "Access Key ID",
      placeholder: "AKIA...",
      hint: "IAM user with identitystore:ListUsers permission",
    },
    {
      key: "secretAccessKey",
      label: "Secret Access Key",
      type: "password" as const,
      placeholder: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    },
    {
      key: "region",
      label: "Region",
      placeholder: "us-east-1",
      hint: "AWS region where IAM Identity Center is configured",
    },
    {
      key: "identityStoreId",
      label: "Identity Store ID",
      placeholder: "d-1234567890",
      hint: "IAM Identity Center console > Settings > Identity store ID",
    },
  ],
  LDAP: [
    {
      key: "host",
      label: "Host",
      placeholder: "ldap.company.com",
      hint: "IP address or hostname of your LDAP server",
    },
    {
      key: "port",
      label: "Port",
      type: "number",
      placeholder: "389 or 636 (LDAPS)",
    },
    {
      key: "ssl",
      label: "SSL/TLS (LDAPS)",
      placeholder: "true",
      hint: "Recommended: use port 636 with SSL enabled",
    },
    {
      key: "bindDN",
      label: "Bind DN",
      placeholder: "cn=readonly,dc=company,dc=com",
      hint: "Read-only account used for LDAP authentication",
    },
    {
      key: "bindPassword",
      label: "Bind password",
      type: "password",
      placeholder: "LDAP account password",
    },
    {
      key: "baseDN",
      label: "Base DN",
      placeholder: "dc=company,dc=com",
      hint: "Root of the LDAP search tree",
    },
    {
      key: "userFilter",
      label: "User filter",
      placeholder: "(&(objectClass=person)(mail=*))",
      hint: "LDAP filter to select active user accounts",
    },
  ],
}
