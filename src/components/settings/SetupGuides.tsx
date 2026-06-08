"use client"

import { useState } from "react"
import { Building2, Globe, Network, Cloud, Shield, Link, AlertTriangle, Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"

type Tab = "AZURE_AD" | "GOOGLE_WORKSPACE" | "LDAP" | "AWS_DIRECTORY" | "OKTA" | "SCIM"

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "AZURE_AD", label: "Azure AD / Entra ID", icon: <Building2 className="size-3.5" /> },
  { id: "GOOGLE_WORKSPACE", label: "Google Workspace", icon: <Globe className="size-3.5" /> },
  { id: "LDAP", label: "LDAP", icon: <Network className="size-3.5" /> },
  { id: "AWS_DIRECTORY", label: "AWS Identity Center", icon: <Cloud className="size-3.5" /> },
  { id: "OKTA", label: "Okta", icon: <Shield className="size-3.5" /> },
  { id: "SCIM", label: "SCIM 2.0", icon: <Link className="size-3.5" /> },
]

function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <span className="group inline-flex items-center gap-1">
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
        {children}
      </code>
      <button
        onClick={copy}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      </button>
    </span>
  )
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 py-2.5">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="text-xs text-foreground">{children}</p>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground mt-0.5">
        {n}
      </span>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {children && <div className="space-y-1.5">{children}</div>}
      </div>
    </div>
  )
}

function Sub({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground leading-relaxed">{children}</p>
}

function AzureGuide() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        DataShield uses client credentials flow (app-only). No user sign-in is required.
        The app reads your directory with a service principal.
      </p>

      <div className="space-y-4">
        <Step n={1} title="Create an App Registration">
          <Sub>
            Go to <strong>portal.azure.com</strong> &gt; Microsoft Entra ID &gt; App registrations &gt; New registration.
          </Sub>
          <Sub>
            Name: anything recognizable (e.g. DataShield). Supported account types: <em>Accounts in this organizational directory only</em>. No redirect URI needed.
          </Sub>
        </Step>

        <Step n={2} title="Copy Tenant ID and Client ID">
          <Sub>
            On the app overview page, copy:
          </Sub>
          <Sub>
            <strong>Application (client) ID</strong> &rarr; Client ID field in DataShield.
          </Sub>
          <Sub>
            <strong>Directory (tenant) ID</strong> &rarr; Tenant ID field in DataShield.
          </Sub>
        </Step>

        <Step n={3} title="Create a Client Secret">
          <Sub>
            Certificates &amp; secrets &gt; New client secret. Set an expiry. Copy the <strong>Value</strong> immediately — it is only shown once.
          </Sub>
          <Warning>
            The secret value is not retrievable after you leave the page. If you lose it, you must create a new one and update DataShield.
          </Warning>
        </Step>

        <Step n={4} title="Add the User.Read.All permission">
          <Sub>
            API permissions &gt; Add a permission &gt; Microsoft Graph &gt; Application permissions.
            Search for <Code>User.Read.All</Code> and add it.
          </Sub>
          <Sub>
            This is an <strong>Application</strong> permission (not Delegated). DataShield acts as the app, not as a user.
          </Sub>
        </Step>

        <Step n={5} title="Grant admin consent">
          <Sub>
            Still in API permissions, click <strong>Grant admin consent for [your org]</strong>. This requires a Global Administrator account.
          </Sub>
          <Sub>
            Without this step the sync will return a 403 even with the correct credentials.
          </Sub>
        </Step>
      </div>

      <Warning>
        Client secrets expire. Set a reminder to rotate the secret before it expires, otherwise the sync will silently fail.
      </Warning>
    </div>
  )
}

function GoogleGuide() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        DataShield uses a service account with domain-wide delegation to read your directory.
        This requires configuration in both Google Cloud Console and the Google Workspace Admin Console.
      </p>

      <div className="space-y-4">
        <Step n={1} title="Enable the Admin SDK API">
          <Sub>
            Go to <strong>console.cloud.google.com</strong>. Select or create a project.
            APIs &amp; Services &gt; Enable APIs &gt; search for <em>Admin SDK API</em> and enable it.
          </Sub>
        </Step>

        <Step n={2} title="Create a service account">
          <Sub>
            IAM &amp; Admin &gt; Service Accounts &gt; Create service account. Name it (e.g. datashield-sync). No role is needed at the project level.
          </Sub>
          <Sub>
            Click the service account &gt; Keys &gt; Add key &gt; Create new key &gt; <strong>JSON</strong>.
            Download the file and keep it secure.
          </Sub>
        </Step>

        <Step n={3} title="Extract the credentials from the JSON file">
          <Sub>
            Open the downloaded JSON. Copy:
          </Sub>
          <Sub>
            <Code>client_email</Code> &rarr; Service account email field in DataShield.
          </Sub>
          <Sub>
            <Code>private_key</Code> &rarr; Private key field in DataShield. Paste the full PEM block including the <Code>-----BEGIN/END-----</Code> lines.
          </Sub>
          <Sub>
            <Code>client_id</Code> (numeric) &rarr; you will need this in step 5.
          </Sub>
        </Step>

        <Step n={4} title="Set the delegated admin email">
          <Sub>
            This must be the email of a Google Workspace account that has the <strong>User Management</strong> admin role (or Super Admin). DataShield impersonates this account to list users.
          </Sub>
          <Warning>
            The delegated admin account must be a human account with the admin role, not the service account itself. Using a Super Admin is simpler but a dedicated admin role account is safer.
          </Warning>
        </Step>

        <Step n={5} title="Configure domain-wide delegation">
          <Sub>
            Go to <strong>admin.google.com</strong> &gt; Security &gt; Access and data control &gt; API controls &gt; Manage domain-wide delegation &gt; Add new.
          </Sub>
          <Sub>
            Client ID: the numeric <Code>client_id</Code> from the JSON file.
          </Sub>
          <Sub>
            OAuth scope: <Code>https://www.googleapis.com/auth/admin.directory.user.readonly</Code>
          </Sub>
          <Sub>
            Click Authorize. This step requires a Super Admin account.
          </Sub>
        </Step>
      </div>

      <Warning>
        Without domain-wide delegation configured in the Admin Console, the sync will return a 403 even with valid service account credentials.
      </Warning>
    </div>
  )
}

function LdapGuide() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        DataShield connects directly to your LDAP server over the network. The server must be reachable from the host running DataShield.
      </p>

      <div className="space-y-4">
        <Step n={1} title="Create a read-only bind account">
          <Sub>
            Create a dedicated user in your directory with read-only access to the OU containing your employees. Do not use an admin account.
          </Sub>
          <Sub>
            Example bind DN: <Code>cn=datashield,ou=service-accounts,dc=company,dc=com</Code>
          </Sub>
          <Sub>
            For Active Directory: grant the account <em>Read</em> permission on the target OU only. Do not add it to any privileged group.
          </Sub>
        </Step>

        <Step n={2} title="Use LDAPS (port 636) if possible">
          <Sub>
            Plain LDAP (port 389) transmits credentials unencrypted. LDAPS encrypts the connection with TLS. Set SSL to <Code>true</Code> and port to <Code>636</Code>.
          </Sub>
          <Warning>
            If your LDAP server uses a self-signed certificate, the connection will fail by default. You must either install the CA certificate on the DataShield host or accept the risk of disabling certificate verification.
          </Warning>
        </Step>

        <Step n={3} title="Set the Base DN">
          <Sub>
            The base DN is the starting point for the user search. Set it as narrow as possible.
          </Sub>
          <Sub>
            Example: <Code>ou=employees,dc=company,dc=com</Code> rather than <Code>dc=company,dc=com</Code>.
          </Sub>
        </Step>

        <Step n={4} title="Set the user filter">
          <Sub>
            The filter controls which LDAP entries are treated as users. It must match entries that have a <Code>mail</Code> attribute.
          </Sub>
          <Sub>
            Active Directory: <Code>(&(objectClass=user)(mail=*)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))</Code> — this excludes disabled accounts.
          </Sub>
          <Sub>
            OpenLDAP: <Code>(&(objectClass=inetOrgPerson)(mail=*))</Code>
          </Sub>
        </Step>

        <Step n={5} title="Network access">
          <Sub>
            The LDAP server must allow incoming connections from the DataShield host on port 636 (or 389).
            If DataShield runs in a cloud environment, your on-premise LDAP server is likely not reachable without a VPN, a reverse proxy, or an explicit firewall rule.
          </Sub>
          <Sub>
            Verify with: <Code>{`ldapsearch -H ldaps://ldap.company.com:636 -D "cn=datashield,dc=company,dc=com" -W -b "dc=company,dc=com" "(mail=*)" mail`}</Code>
          </Sub>
        </Step>
      </div>
    </div>
  )
}

function AWSGuide() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        DataShield connects to AWS IAM Identity Center via the Identity Store API. This works
        whether your identity source is AWS Managed Microsoft AD, an external IdP, or the
        built-in Identity Center directory.
      </p>

      <div className="space-y-4">
        <Step n={1} title="Enable IAM Identity Center">
          <Sub>
            Go to the <strong>AWS Management Console</strong> and open <strong>IAM Identity Center</strong> (search for it in the top bar).
            If not already enabled, click Enable. IAM Identity Center is a free service but must be enabled once per AWS organization.
          </Sub>
          <Warning>
            IAM Identity Center is region-specific. Note the region where you enable it — you must use the same region in DataShield.
          </Warning>
        </Step>

        <Step n={2} title="Find the Identity Store ID">
          <Sub>
            In the IAM Identity Center console, go to <strong>Settings</strong>. Under the Identity source section,
            copy the <strong>Identity store ID</strong>. It starts with <Code>d-</Code> followed by 10 characters (e.g. <Code>d-1234567890</Code>).
          </Sub>
        </Step>

        <Step n={3} title="Create an IAM user for DataShield">
          <Sub>
            Go to <strong>IAM</strong> (not Identity Center) and create a dedicated user for DataShield.
            Select <em>Programmatic access</em> to get an Access Key ID and Secret Access Key.
          </Sub>
          <Sub>
            Attach the following inline policy to the user — it grants read-only access to list users:
          </Sub>
          <div className="rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs leading-relaxed text-foreground whitespace-pre">{`{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "identitystore:ListUsers",
      "identitystore:DescribeUser"
    ],
    "Resource": "*"
  }]
}`}</div>
        </Step>

        <Step n={4} title="Enter credentials in DataShield">
          <Sub>
            Access Key ID and Secret Access Key: from the IAM user created in step 3.
          </Sub>
          <Sub>
            Region: the AWS region where IAM Identity Center is enabled (e.g. <Code>us-east-1</Code>, <Code>eu-west-1</Code>).
          </Sub>
          <Sub>
            Identity Store ID: the <Code>d-</Code> value from step 2.
          </Sub>
        </Step>
      </div>

      <Warning>
        IAM credentials are long-lived. Prefer creating an IAM user with only the two permissions above rather than using credentials with broad access. Rotate the access key periodically.
      </Warning>
    </div>
  )
}

function OktaGuide() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        DataShield uses the Okta Users API with an API token to pull active users from your organization.
      </p>
      <div className="space-y-4">
        <Step n={1} title="Find your Okta domain">
          <Sub>
            Your Okta domain is the URL you use to sign in, e.g. <Code>company.okta.com</Code> or <Code>company.okta-emea.com</Code>.
            Enter it without <Code>https://</Code>.
          </Sub>
        </Step>
        <Step n={2} title="Create an API token">
          <Sub>
            In the Okta Admin Console, go to <strong>Security</strong> &gt; <strong>API</strong> &gt; <strong>Tokens</strong> &gt; Create token.
          </Sub>
          <Sub>
            Name it (e.g. DataShield). Copy the token value immediately — it is only shown once.
          </Sub>
          <Warning>
            The API token inherits the permissions of the admin account that created it. Create a dedicated read-only admin account in Okta and generate the token from that account to limit the blast radius if the token is compromised.
          </Warning>
        </Step>
        <Step n={3} title="Read-only admin role">
          <Sub>
            To create a read-only admin in Okta: Admin Console &gt; Security &gt; Administrators &gt; Add administrator.
            Assign the <em>Read-Only Administrator</em> role. This role can list users but cannot modify anything.
          </Sub>
        </Step>
      </div>
    </div>
  )
}

function SCIMGuide() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        SCIM 2.0 is a standard protocol supported by OVH, JumpCloud, OneLogin, Ping Identity,
        IBM Security Verify, Oracle IDCS, Salesforce Identity, and many others.
        Instead of DataShield pulling from your IdP, your IdP pushes users to DataShield automatically.
      </p>
      <div className="space-y-4">
        <Step n={1} title="Create the SCIM connection in DataShield">
          <Sub>
            Click <strong>Connect directory</strong>, choose <strong>SCIM 2.0</strong>, enter a name and save.
            DataShield will generate a unique endpoint URL and bearer token.
          </Sub>
          <Warning>
            Copy the bearer token immediately after creation — it is only shown once and cannot be retrieved later.
          </Warning>
        </Step>
        <Step n={2} title="Configure your identity provider">
          <Sub>
            In your IdP (OVH, JumpCloud, OneLogin, etc.), go to the SCIM or provisioning settings and enter:
          </Sub>
          <Sub>
            <strong>SCIM base URL:</strong> the endpoint URL shown in DataShield (ends in <Code>/api/scim/[id]/Users</Code>).
          </Sub>
          <Sub>
            <strong>Authentication:</strong> Bearer token — paste the token generated by DataShield.
          </Sub>
          <Sub>
            <strong>SCIM version:</strong> 2.0.
          </Sub>
        </Step>
        <Step n={3} title="Enable user provisioning">
          <Sub>
            In your IdP, enable provisioning for the relevant group or the entire directory.
            Most IdPs will immediately push a full sync on first activation, then send incremental updates on user changes.
          </Sub>
        </Step>
        <Step n={4} title="Supported SCIM operations">
          <Sub>
            DataShield handles: <Code>POST /Users</Code> (create), <Code>GET /Users</Code> (list), <Code>PATCH /Users/:id</Code> (update), <Code>DELETE /Users/:id</Code> (acknowledged but the employee is kept for breach history).
          </Sub>
          <Sub>
            Setting <Code>active: false</Code> in a PATCH is acknowledged without deleting the record.
          </Sub>
        </Step>
      </div>
    </div>
  )
}

export function SetupGuides() {
  const [active, setActive] = useState<Tab>("AZURE_AD")

  return (
    <section>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Setup guides</h3>
        <p className="text-xs text-muted-foreground">
          Prerequisites to configure outside DataShield before a sync can succeed.
        </p>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="flex border-b border-border bg-muted/40">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors",
                active === tab.id
                  ? "border-b-2 border-primary text-foreground bg-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {active === "AZURE_AD" && <AzureGuide />}
          {active === "GOOGLE_WORKSPACE" && <GoogleGuide />}
          {active === "LDAP" && <LdapGuide />}
          {active === "AWS_DIRECTORY" && <AWSGuide />}
          {active === "OKTA" && <OktaGuide />}
          {active === "SCIM" && <SCIMGuide />}
        </div>
      </div>
    </section>
  )
}
