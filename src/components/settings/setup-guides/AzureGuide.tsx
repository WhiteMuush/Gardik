import { Code, Step, Sub, Warning } from "./parts"

export function AzureGuide() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Gardik uses client credentials flow (app-only). No user sign-in is required. The app reads your
        directory with a service principal.
      </p>

      <div className="space-y-4">
        <Step n={1} title="Create an App Registration">
          <Sub>
            Go to <strong>portal.azure.com</strong> &gt; Microsoft Entra ID &gt; App registrations &gt; New
            registration.
          </Sub>
          <Sub>
            Name: anything recognizable (e.g. Gardik). Supported account types:{" "}
            <em>Accounts in this organizational directory only</em>. No redirect URI needed.
          </Sub>
        </Step>

        <Step n={2} title="Copy Tenant ID and Client ID">
          <Sub>On the app overview page, copy:</Sub>
          <Sub>
            <strong>Application (client) ID</strong> &rarr; Client ID field in Gardik.
          </Sub>
          <Sub>
            <strong>Directory (tenant) ID</strong> &rarr; Tenant ID field in Gardik.
          </Sub>
        </Step>

        <Step n={3} title="Create a Client Secret">
          <Sub>
            Certificates &amp; secrets &gt; New client secret. Set an expiry. Copy the <strong>Value</strong>{" "}
            immediately, it is only shown once.
          </Sub>
          <Warning>
            The secret value is not retrievable after you leave the page. If you lose it, you must create a
            new one and update Gardik.
          </Warning>
        </Step>

        <Step n={4} title="Add the User.Read.All permission">
          <Sub>
            API permissions &gt; Add a permission &gt; Microsoft Graph &gt; Application permissions. Search
            for <Code>User.Read.All</Code> and add it.
          </Sub>
          <Sub>
            This is an <strong>Application</strong> permission (not Delegated). Gardik acts as the app, not as
            a user.
          </Sub>
        </Step>

        <Step n={5} title="Grant admin consent">
          <Sub>
            Still in API permissions, click <strong>Grant admin consent for [your org]</strong>. This requires
            a Global Administrator account.
          </Sub>
          <Sub>Without this step the sync will return a 403 even with the correct credentials.</Sub>
        </Step>
      </div>

      <Warning>
        Client secrets expire. Set a reminder to rotate the secret before it expires, otherwise the sync will
        silently fail.
      </Warning>
    </div>
  )
}
