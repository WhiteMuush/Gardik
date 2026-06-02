export type AzureADConfig = {
  tenantId: string
  clientId: string
  clientSecret: string
}

export type GoogleWorkspaceConfig = {
  serviceAccountEmail: string
  privateKey: string
  delegatedAdminEmail: string
  domain: string
}

export type LDAPConfig = {
  host: string
  port: number
  ssl: boolean
  bindDN: string
  bindPassword: string
  baseDN: string
  userFilter: string
}

export type AWSDirectoryConfig = {
  accessKeyId: string
  secretAccessKey: string
  region: string
  identityStoreId: string
}

export type DirectoryConfig = AzureADConfig | GoogleWorkspaceConfig | LDAPConfig | AWSDirectoryConfig

export type DirectoryUser = {
  email: string
  firstName: string
  lastName: string
  department?: string
}

export type TestResult = {
  ok: boolean
  userCount?: number
  error?: string
}
