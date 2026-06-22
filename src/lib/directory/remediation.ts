import type { DirectoryType, RemediationType } from "@prisma/client"
import { decryptConfig } from "./crypto"
import { revokeAzureSessions } from "./azure"
import { googleForcePasswordReset, googleSignOut } from "./google"
import { oktaExpirePassword, oktaRevokeSessions } from "./okta"
import type { AzureADConfig, GoogleWorkspaceConfig, OktaConfig } from "./types"

// Which remediation actions each directory type can perform. LDAP, AWS and
// SCIM expose no usable remediation API, so they support nothing.
const CAPABILITIES: Record<DirectoryType, RemediationType[]> = {
  AZURE_AD: ["REVOKE_SESSIONS"],
  GOOGLE_WORKSPACE: ["REVOKE_SESSIONS", "FORCE_PASSWORD_RESET"],
  OKTA: ["REVOKE_SESSIONS", "FORCE_PASSWORD_RESET"],
  LDAP: [],
  AWS_DIRECTORY: [],
  SCIM: [],
}

export function remediationCapabilities(type: DirectoryType): RemediationType[] {
  return CAPABILITIES[type]
}

export function supportsRemediation(type: DirectoryType, action: RemediationType): boolean {
  return CAPABILITIES[type].includes(action)
}

// Run a single remediation against the directory for one employee. Throws on
// any provider error; the caller records the outcome to the audit trail.
export async function executeRemediation(
  type: DirectoryType,
  encryptedConfig: string,
  action: RemediationType,
  email: string
): Promise<void> {
  if (!supportsRemediation(type, action)) {
    throw new Error(`${type} does not support ${action}`)
  }
  switch (type) {
    case "AZURE_AD":
      return revokeAzureSessions(decryptConfig<AzureADConfig>(encryptedConfig), email)
    case "GOOGLE_WORKSPACE": {
      const config = decryptConfig<GoogleWorkspaceConfig>(encryptedConfig)
      return action === "REVOKE_SESSIONS"
        ? googleSignOut(config, email)
        : googleForcePasswordReset(config, email)
    }
    case "OKTA": {
      const config = decryptConfig<OktaConfig>(encryptedConfig)
      return action === "REVOKE_SESSIONS"
        ? oktaRevokeSessions(config, email)
        : oktaExpirePassword(config, email)
    }
    default:
      throw new Error(`${type} does not support remediation`)
  }
}
