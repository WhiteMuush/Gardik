import type { DirectoryType } from "../connect-wizard/providers"
import { AzureGuide } from "../setup-guides/AzureGuide"
import { GoogleGuide } from "../setup-guides/GoogleGuide"
import { LdapGuide } from "../setup-guides/LdapGuide"
import { AWSGuide } from "../setup-guides/AWSGuide"
import { OktaGuide } from "../setup-guides/OktaGuide"
import { SCIMGuide } from "../setup-guides/SCIMGuide"

export const GUIDES: Record<DirectoryType, () => React.ReactNode> = {
  AZURE_AD: AzureGuide,
  GOOGLE_WORKSPACE: GoogleGuide,
  LDAP: LdapGuide,
  AWS_DIRECTORY: AWSGuide,
  OKTA: OktaGuide,
  SCIM: SCIMGuide,
}
