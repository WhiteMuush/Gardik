import { Code, Step, Sub, Warning } from "./parts"

export function GoogleGuide() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Gardik uses a service account with domain-wide delegation to read your directory. This requires
        configuration in both Google Cloud Console and the Google Workspace Admin Console.
      </p>

      <div className="space-y-4">
        <Step n={1} title="Enable the Admin SDK API">
          <Sub>
            Go to <strong>console.cloud.google.com</strong>. Select or create a project. APIs &amp; Services
            &gt; Enable APIs &gt; search for <em>Admin SDK API</em> and enable it.
          </Sub>
        </Step>

        <Step n={2} title="Create a service account">
          <Sub>
            IAM &amp; Admin &gt; Service Accounts &gt; Create service account. Name it (e.g. gardik-sync). No
            role is needed at the project level.
          </Sub>
          <Sub>
            Click the service account &gt; Keys &gt; Add key &gt; Create new key &gt; <strong>JSON</strong>.
            Download the file and keep it secure.
          </Sub>
        </Step>

        <Step n={3} title="Extract the credentials from the JSON file">
          <Sub>Open the downloaded JSON. Copy:</Sub>
          <Sub>
            <Code>client_email</Code> &rarr; Service account email field in Gardik.
          </Sub>
          <Sub>
            <Code>private_key</Code> &rarr; Private key field in Gardik. Paste the full PEM block including
            the <Code>-----BEGIN/END-----</Code> lines.
          </Sub>
          <Sub>
            <Code>client_id</Code> (numeric) &rarr; you will need this in step 5.
          </Sub>
        </Step>

        <Step n={4} title="Set the delegated admin email">
          <Sub>
            This must be the email of a Google Workspace account that has the <strong>User Management</strong>{" "}
            admin role (or Super Admin). Gardik impersonates this account to list users.
          </Sub>
          <Warning>
            The delegated admin account must be a human account with the admin role, not the service account
            itself. Using a Super Admin is simpler but a dedicated admin role account is safer.
          </Warning>
        </Step>

        <Step n={5} title="Configure domain-wide delegation">
          <Sub>
            Go to <strong>admin.google.com</strong> &gt; Security &gt; Access and data control &gt; API
            controls &gt; Manage domain-wide delegation &gt; Add new.
          </Sub>
          <Sub>
            Client ID: the numeric <Code>client_id</Code> from the JSON file.
          </Sub>
          <Sub>
            OAuth scope: <Code>https://www.googleapis.com/auth/admin.directory.user.readonly</Code>
          </Sub>
          <Sub>Click Authorize. This step requires a Super Admin account.</Sub>
        </Step>
      </div>

      <Warning>
        Without domain-wide delegation configured in the Admin Console, the sync will return a 403 even with
        valid service account credentials.
      </Warning>
    </div>
  )
}
