import { Code, Step, Sub, Warning } from "./parts"

export function OktaGuide() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Gardik uses the Okta Users API with an API token to pull active users from your organization.
      </p>
      <div className="space-y-4">
        <Step n={1} title="Find your Okta domain">
          <Sub>
            Your Okta domain is the URL you use to sign in, e.g. <Code>company.okta.com</Code> or{" "}
            <Code>company.okta-emea.com</Code>. Enter it without <Code>https://</Code>.
          </Sub>
        </Step>
        <Step n={2} title="Create an API token">
          <Sub>
            In the Okta Admin Console, go to <strong>Security</strong> &gt; <strong>API</strong> &gt;{" "}
            <strong>Tokens</strong> &gt; Create token.
          </Sub>
          <Sub>Name it (e.g. Gardik). Copy the token value immediately, it is only shown once.</Sub>
          <Warning>
            The API token inherits the permissions of the admin account that created it. Create a dedicated
            read-only admin account in Okta and generate the token from that account to limit the blast radius
            if the token is compromised.
          </Warning>
        </Step>
        <Step n={3} title="Read-only admin role">
          <Sub>
            To create a read-only admin in Okta: Admin Console &gt; Security &gt; Administrators &gt; Add
            administrator. Assign the <em>Read-Only Administrator</em> role. This role can list users but
            cannot modify anything.
          </Sub>
        </Step>
      </div>
    </div>
  )
}
